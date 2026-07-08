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
  name: "get_demand",
  title: "Get demand",
  description: "Fetch a single SoMA demand by id, including its assignees.",
  inputSchema: {
    demand_id: z.string().uuid().describe("Demand UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = sb(ctx);
    const { data: demand, error } = await client
      .from("demands")
      .select(
        "id, title, description, status_id, board_id, team_id, priority, due_date, created_at, delivered_at, archived",
      )
      .eq("id", demand_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!demand) return { content: [{ type: "text", text: "Demand not found" }], isError: true };

    const { data: assignees } = await client
      .from("demand_assignees")
      .select("user_id, is_primary")
      .eq("demand_id", demand_id);

    const result = { ...demand, assignees: assignees ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: { demand: result },
    };
  },
});
