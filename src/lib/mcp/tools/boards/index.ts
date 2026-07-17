import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid, zBoardRole } from "../../_shared/zod-common";

export const listBoardsTool = defineTool({
  name: "list_boards",
  title: "List boards",
  description: "List active boards for a team. Respects RLS — only boards the user can see.",
  inputSchema: { team_id: zUuid, include_archived: z.boolean().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, include_archived }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("boards")
      .select("id, name, description, team_id, archived_at, created_at, created_by")
      .eq("team_id", team_id).order("created_at");
    if (!include_archived) q = q.is("archived_at", null);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("boards", data ?? []);
  },
});

export const getBoardTool = defineTool({
  name: "get_board",
  title: "Get board",
  description: "Fetch a single board by id.",
  inputSchema: { board_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("boards").select("*").eq("id", board_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Board not found");
    return ok({ board: data }, { open_url: urls.board(board_id) });
  },
});

export const createBoardTool = defineTool({
  name: "create_board",
  title: "Create board",
  description: "Create a new board in a team. The board is initialized with default statuses.",
  inputSchema: {
    team_id: zUuid,
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("boards")
      .insert({ ...input, created_by: ctx.getUserId() })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ board: data }, { open_url: data ? urls.board(data.id) : null });
  },
});

export const updateBoardTool = defineTool({
  name: "update_board",
  title: "Update board",
  description: "Update board name or description.",
  inputSchema: {
    board_id: zUuid,
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ board_id, ...patch }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    Object.keys(patch).forEach(k => (patch as any)[k] === undefined && delete (patch as any)[k]);
    if (!Object.keys(patch).length) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("boards").update(patch).eq("id", board_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ board: data }, { open_url: urls.board(board_id) });
  },
});

export const archiveBoardTool = defineTool({
  name: "archive_board",
  title: "Archive board",
  description: "Archive a board (reversible — hides it from active views).",
  inputSchema: { board_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("boards")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", board_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ board: data });
  },
});

export const listBoardMembersTool = defineTool({
  name: "list_board_members",
  title: "List board members",
  description: "List members of a board with role (admin, moderator, executor, requester).",
  inputSchema: { board_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("board_members")
      .select("user_id, role, added_at, profiles(id, full_name, avatar_url, email, job_title)")
      .eq("board_id", board_id);
    if (error) return fromPgError(error);
    return okList("members", data ?? []);
  },
});

export const addBoardMemberTool = defineTool({
  name: "add_board_member",
  title: "Add board member",
  description: "Add a team user to a board with a specific role.",
  inputSchema: { board_id: zUuid, user_id: zUuid, role: zBoardRole },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, user_id, role }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("board_members")
      .upsert({ board_id, user_id, role }, { onConflict: "board_id,user_id" })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ member: data });
  },
});

export const updateBoardMemberRoleTool = defineTool({
  name: "update_board_member_role",
  title: "Update board member role",
  description: "Change a board member's role.",
  inputSchema: { board_id: zUuid, user_id: zUuid, role: zBoardRole },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, user_id, role }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("board_members")
      .update({ role }).eq("board_id", board_id).eq("user_id", user_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ member: data });
  },
});

export const removeBoardMemberTool = defineTool({
  name: "remove_board_member",
  title: "Remove board member",
  description: "Remove a user from a board.",
  inputSchema: { board_id: zUuid, user_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, user_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("board_members").delete().eq("board_id", board_id).eq("user_id", user_id);
    if (error) return fromPgError(error);
    return okDeleted(user_id);
  },
});

export const listBoardStatusesTool = defineTool({
  name: "list_board_statuses",
  title: "List board statuses",
  description: "List the Kanban stages for a board, ordered by position.",
  inputSchema: { board_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("board_statuses")
      .select("id, name, position, color, board_id")
      .eq("board_id", board_id).order("position");
    if (error) return fromPgError(error);
    return okList("statuses", data ?? []);
  },
});

export const listBoardServicesTool = defineTool({
  name: "list_board_services",
  title: "List board services",
  description: "List services attached (authorized) to a board.",
  inputSchema: { board_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("board_services")
      .select("service_id, monthly_limit, services(id, name, description, estimated_hours, price_cents)")
      .eq("board_id", board_id);
    if (error) return fromPgError(error);
    return okList("services", data ?? []);
  },
});

export const attachServiceToBoardTool = defineTool({
  name: "attach_service_to_board",
  title: "Attach service to board",
  description: "Authorize a service on a board, optionally with a monthly limit.",
  inputSchema: { board_id: zUuid, service_id: zUuid, monthly_limit: z.number().int().min(0).nullable().optional() },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, service_id, monthly_limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("board_services")
      .upsert({ board_id, service_id, monthly_limit: monthly_limit ?? null }, { onConflict: "board_id,service_id" })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ attachment: data });
  },
});
