import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "search_demands",
  title: "Search demands",
  description:
    "Search SoMA demands the signed-in user can see (via RLS) by title/description substring.",
  inputSchema: {
    query: z.string().min(1).describe("Text to match in demand title or description."),
    board_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, board_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const escaped = query.replace(/[%_]/g, (m) => `\\${m}`);
    let q = sb(ctx)
      .from("demands")
      .select("id, title, description, status_id, board_id, priority, due_date, created_at")
      .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { demands: data ?? [] },
    };
  },
});
