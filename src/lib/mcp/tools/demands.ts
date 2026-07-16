import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listDemandsTool = defineTool({
  name: "list_demands",
  title: "List demands",
  description: "List demands on a board. Optional filters: status_id, limit (default 50, max 200).",
  inputSchema: {
    board_id: z.string().uuid(),
    status_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, status_id, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("demands")
      .select("id, title, description, status_id, board_id, due_date, priority, sequence_number, created_at, updated_at")
      .eq("board_id", board_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status_id) q = q.eq("status_id", status_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ demands: data ?? [] });
  },
});

export const getDemandTool = defineTool({
  name: "get_demand",
  title: "Get demand",
  description: "Fetch a single demand by id, with its board, status, and creator.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demands")
      .select("*")
      .eq("id", demand_id)
      .maybeSingle();
    if (error) return fromPgError(error);
    return ok({ demand: data });
  },
});

export const createDemandTool = defineTool({
  name: "create_demand",
  title: "Create demand",
  description: "Create a new demand on a board.",
  inputSchema: {
    board_id: z.string().uuid(),
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20000).optional(),
    status_id: z.string().uuid().optional().describe("Optional initial status. If omitted, uses the board's default."),
    due_date: z.string().optional().describe("ISO date (YYYY-MM-DD)."),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const patch: Record<string, unknown> = { ...input, created_by: ctx.getUserId() };
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    const { data, error } = await sb(ctx).from("demands").insert(patch).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ demand: data });
  },
});

export const updateDemandStatusTool = defineTool({
  name: "update_demand_status",
  title: "Update demand status",
  description: "Move a demand to a different status (column) on its board.",
  inputSchema: {
    demand_id: z.string().uuid(),
    status_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, status_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demands")
      .update({ status_id }).eq("id", demand_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ demand: data });
  },
});

export const listBoardStatusesTool = defineTool({
  name: "list_board_statuses",
  title: "List board statuses",
  description: "List the status columns (Kanban stages) for a board.",
  inputSchema: { board_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_statuses")
      .select("id, name, position, color, board_id")
      .eq("board_id", board_id)
      .order("position");
    if (error) return fromPgError(error);
    return ok({ statuses: data ?? [] });
  },
});
