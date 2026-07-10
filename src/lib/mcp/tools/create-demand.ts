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
  name: "create_demand",
  title: "Create demand",
  description:
    "Create a new SoMA demand on a board as the signed-in user. Resolves the board's team, uses the first active status of the board when status_id is omitted, and assigns the caller as the responsible when assignee_user_id is omitted. Respects RLS and plan limits.",
  inputSchema: {
    board_id: z.string().uuid().describe("Board UUID where the demand will be created."),
    title: z.string().trim().min(1).max(200).describe("Demand title."),
    description: z.string().optional().describe("Optional demand description."),
    priority: z
      .enum(["baixa", "média", "alta", "urgente"])
      .default("média")
      .describe("Priority: baixa | média | alta | urgente."),
    due_date: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe("Optional ISO-8601 due date (with timezone)."),
    status_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional board status UUID. Defaults to the first active status on the board."),
    service_id: z.string().uuid().optional().describe("Optional service UUID."),
    assignee_user_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional responsible user UUID. Defaults to the signed-in user."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = sb(ctx);
    const userId = ctx.getUserId();
    const {
      board_id,
      title,
      description,
      priority,
      due_date,
      service_id,
      assignee_user_id,
    } = input;
    let { status_id } = input;

    // 1) Resolve team_id from board (RLS enforces access).
    const { data: board, error: bErr } = await client
      .from("boards")
      .select("id, team_id")
      .eq("id", board_id)
      .maybeSingle();
    if (bErr) return { content: [{ type: "text", text: bErr.message }], isError: true };
    if (!board) {
      return {
        content: [{ type: "text", text: "Board not found or not accessible" }],
        isError: true,
      };
    }

    // 2) Resolve default status when not provided.
    if (!status_id) {
      const { data: st, error: sErr } = await client
        .from("board_statuses")
        .select("status_id, position")
        .eq("board_id", board_id)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
      if (!st) {
        return {
          content: [{ type: "text", text: "No active status found on this board" }],
          isError: true,
        };
      }
      status_id = st.status_id as string;
    }

    // 3) Insert demand. Triggers handle sequence, plan limits, notifications.
    const { data: demand, error: dErr } = await client
      .from("demands")
      .insert({
        board_id,
        team_id: board.team_id,
        status_id,
        title,
        description: description ?? null,
        priority,
        due_date: due_date ?? null,
        service_id: service_id ?? null,
        created_by: userId,
      })
      .select(
        "id, title, description, board_id, team_id, status_id, priority, due_date, service_id, created_at",
      )
      .single();
    if (dErr) return { content: [{ type: "text", text: dErr.message }], isError: true };

    // 4) Assign responsible (primary).
    const responsibleId = assignee_user_id ?? userId!;
    const { error: aErr } = await client.from("demand_assignees").insert({
      demand_id: demand.id,
      user_id: responsibleId,
      is_primary: true,
    });
    if (aErr) {
      return {
        content: [
          {
            type: "text",
            text: `Demand ${demand.id} created but failed to assign responsible: ${aErr.message}`,
          },
        ],
        structuredContent: { demand, assignee_error: aErr.message },
        isError: true,
      };
    }

    const result = { ...demand, responsible_user_id: responsibleId };
    return {
      content: [
        {
          type: "text",
          text: `Created demand ${demand.id} "${demand.title}" on board ${board_id}.`,
        },
      ],
      structuredContent: { demand: result },
    };
  },
});
