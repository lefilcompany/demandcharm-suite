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
  name: "list_my_demands",
  title: "List my demands",
  description:
    "List demands where the signed-in user is a responsible or follower assignee. Optionally filter by board.",
  inputSchema: {
    board_id: z.string().uuid().optional().describe("Optional board UUID to filter by."),
    include_archived: z.boolean().default(false).describe("Include archived demands."),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, include_archived, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = sb(ctx);
    const userId = ctx.getUserId();

    const { data: assignments, error: aErr } = await client
      .from("demand_assignees")
      .select("demand_id")
      .eq("user_id", userId);
    if (aErr) return { content: [{ type: "text", text: aErr.message }], isError: true };

    const ids = (assignments ?? []).map((a: { demand_id: string }) => a.demand_id);
    if (ids.length === 0) {
      return {
        content: [{ type: "text", text: "[]" }],
        structuredContent: { demands: [] },
      };
    }

    let query = client
      .from("demands")
      .select("id, title, description, status_id, board_id, priority, due_date, created_at, archived")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (board_id) query = query.eq("board_id", board_id);
    if (!include_archived) query = query.eq("archived", false);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { demands: data ?? [] },
    };
  },
});
