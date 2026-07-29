import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Supabase client autenticado como o usuário do token OAuth verificado.
 * O token é encaminhado para que o RLS rode como esse usuário.
 */
export function sb(ctx: ToolContext): SupabaseClient {
  const token = ctx?.getToken?.();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// Re-export for backwards compatibility with older tool files.
export { ok, err, fromPgError, requireAuth } from "./envelope";
