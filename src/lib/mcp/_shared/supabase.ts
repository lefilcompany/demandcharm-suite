import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Create a Supabase client bound to the MCP caller's JWT.
 * RLS is enforced as the signed-in user — never use service_role here.
 */
export function sb(ctx: ToolContext): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return { content: [{ type: "text" as const, text: "PERMISSION_DENIED: Not authenticated" }], isError: true as const };
  }
  return null;
}

export function ok(data: unknown, message?: string) {
  return {
    content: [{ type: "text" as const, text: message ?? JSON.stringify(data) }],
    structuredContent: (typeof data === "object" && data !== null ? (data as Record<string, unknown>) : { data }),
  };
}

export function err(message: string, code = "ERROR") {
  return { content: [{ type: "text" as const, text: `${code}: ${message}` }], isError: true as const };
}

export function fromPgError(e: { message?: string; code?: string } | null | undefined) {
  if (!e) return err("Unknown error");
  const msg = e.message ?? "Database error";
  if (msg.startsWith("PLAN_LIMIT_")) return err(msg, "PLAN_LIMIT");
  if (e.code === "42501" || /permission denied/i.test(msg)) return err(msg, "PERMISSION_DENIED");
  if (e.code === "PGRST116" || /not found/i.test(msg)) return err(msg, "NOT_FOUND");
  return err(msg, "DB_ERROR");
}
