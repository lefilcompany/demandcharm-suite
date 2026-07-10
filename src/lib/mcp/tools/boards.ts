import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError, err } from "../_shared/supabase";

const boardRole = z.enum(["admin", "moderator", "executor", "requester"]);

export const listBoardsTool = defineTool({
  name: "list_boards",
  title: "List boards",
  description: "List boards the signed-in user has access to (via RLS).",
  inputSchema: {
    team_id: z.string().uuid().optional().describe("Optional team filter."),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("boards").select("id, name, description, team_id, is_default, monthly_demand_limit, archived, created_at")
      .order("created_at", { ascending: false }).limit(limit);
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ boards: data ?? [] });
  },
});

export const getBoardTool = defineTool({
  name: "get_board",
  title: "Get board",
  description: "Fetch a board with its statuses, services and members.",
  inputSchema: { board_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data: board, error } = await c.from("boards").select("*").eq("id", board_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!board) return err("Board not found", "NOT_FOUND");
    const [{ data: statuses }, { data: services }, { data: members }] = await Promise.all([
      c.from("board_statuses").select("status_id, position, is_active, adjustment_type, demand_statuses(id, name, color)").eq("board_id", board_id).order("position"),
      c.from("board_services").select("service_id, monthly_limit, services(id, name, category, parent_id)").eq("board_id", board_id),
      c.from("board_members").select("user_id, role, added_by, profiles(id, full_name, avatar_url)").eq("board_id", board_id),
    ]);
    return ok({ board, statuses: statuses ?? [], services: services ?? [], members: members ?? [] });
  },
});

export const createBoardTool = defineTool({
  name: "create_board",
  title: "Create board",
  description: "Create a new board with default stages (or custom stages) and optional services and members. Requires team admin or moderator.",
  inputSchema: {
    team_id: z.string().uuid(),
    name: z.string().trim().min(1).max(100),
    description: z.string().optional(),
    services: z.array(z.object({ service_id: z.string().uuid(), monthly_limit: z.number().int().min(0).optional() })).optional(),
    stages: z.array(z.object({ name: z.string().min(1), color: z.string().optional(), adjustment_type: z.enum(["none", "internal", "external"]).optional() })).optional(),
    members: z.array(z.object({ user_id: z.string().uuid(), role: boardRole.optional() })).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).rpc("create_board_with_services", {
      p_team_id: input.team_id, p_name: input.name, p_description: input.description ?? null,
      p_services: input.services ?? [], p_stages: input.stages ?? null, p_members: input.members ?? [],
    });
    if (error) return fromPgError(error);
    return ok({ board: data });
  },
});

export const updateBoardTool = defineTool({
  name: "update_board",
  title: "Update board",
  description: "Update board name, description or monthly_demand_limit. Requires board admin/moderator.",
  inputSchema: {
    board_id: z.string().uuid(),
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().optional(),
    monthly_demand_limit: z.number().int().min(0).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ board_id, ...patch }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return ok({ updated: false });
    const { data, error } = await sb(ctx).from("boards").update(clean).eq("id", board_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ board: data });
  },
});

export const archiveBoardTool = defineTool({
  name: "archive_board",
  title: "Archive board",
  description: "Archive a board (soft-delete). Requires board admin.",
  inputSchema: { board_id: z.string().uuid(), archived: z.boolean().default(true) },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ board_id, archived }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("boards").update({ archived }).eq("id", board_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ board: data });
  },
});

export const deleteBoardTool = defineTool({
  name: "delete_board",
  title: "Delete board",
  description: "Permanently delete a board and its cascading data. Requires board admin. Irreversible.",
  inputSchema: { board_id: z.string().uuid(), confirm: z.literal(true).describe("Must be true to confirm irreversible delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  handler: async ({ board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("boards").delete().eq("id", board_id);
    if (error) return fromPgError(error);
    return ok({ deleted: board_id });
  },
});

export const listBoardMembersTool = defineTool({
  name: "list_board_members",
  title: "List board members",
  description: "List all members of a board with their board role.",
  inputSchema: { board_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_members")
      .select("user_id, role, added_by, profiles(id, full_name, avatar_url, email, job_title)").eq("board_id", board_id);
    if (error) return fromPgError(error);
    return ok({ members: data ?? [] });
  },
});

export const addBoardMemberTool = defineTool({
  name: "add_board_member",
  title: "Add board member",
  description: "Add a team member to a board with a given role (admin/moderator/executor/requester). Requires board admin.",
  inputSchema: { board_id: z.string().uuid(), user_id: z.string().uuid(), role: boardRole.default("executor") },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ board_id, user_id, role }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_members")
      .upsert({ board_id, user_id, role, added_by: ctx.getUserId() }, { onConflict: "board_id,user_id" })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ member: data });
  },
});

export const updateBoardMemberRoleTool = defineTool({
  name: "update_board_member_role",
  title: "Update board member role",
  description: "Change a board member's role. Requires board admin.",
  inputSchema: { board_id: z.string().uuid(), user_id: z.string().uuid(), role: boardRole },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ board_id, user_id, role }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_members").update({ role }).eq("board_id", board_id).eq("user_id", user_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ member: data });
  },
});

export const removeBoardMemberTool = defineTool({
  name: "remove_board_member",
  title: "Remove board member",
  description: "Remove a user from a board. Requires board admin.",
  inputSchema: { board_id: z.string().uuid(), user_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ board_id, user_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("board_members").delete().eq("board_id", board_id).eq("user_id", user_id);
    if (error) return fromPgError(error);
    return ok({ removed: user_id });
  },
});

export const listBoardStatusesTool = defineTool({
  name: "list_board_statuses",
  title: "List board statuses",
  description: "List active statuses (columns/stages) of a board in order.",
  inputSchema: { board_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_statuses")
      .select("status_id, position, is_active, adjustment_type, demand_statuses(id, name, color)")
      .eq("board_id", board_id).order("position");
    if (error) return fromPgError(error);
    return ok({ statuses: data ?? [] });
  },
});

export const listBoardServicesTool = defineTool({
  name: "list_board_services",
  title: "List board services",
  description: "List services attached to a board with their monthly limits.",
  inputSchema: { board_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_services")
      .select("service_id, monthly_limit, services(id, name, category, parent_id)").eq("board_id", board_id);
    if (error) return fromPgError(error);
    return ok({ services: data ?? [] });
  },
});

export const attachServiceToBoardTool = defineTool({
  name: "attach_service_to_board",
  title: "Attach service to board",
  description: "Attach a team service to a board with optional monthly_limit (0 = unlimited).",
  inputSchema: { board_id: z.string().uuid(), service_id: z.string().uuid(), monthly_limit: z.number().int().min(0).default(0) },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ board_id, service_id, monthly_limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("board_services")
      .upsert({ board_id, service_id, monthly_limit }, { onConflict: "board_id,service_id" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ board_service: data });
  },
});

export const detachServiceFromBoardTool = defineTool({
  name: "detach_service_from_board",
  title: "Detach service from board",
  description: "Remove a service from a board.",
  inputSchema: { board_id: z.string().uuid(), service_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ board_id, service_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("board_services").delete().eq("board_id", board_id).eq("service_id", service_id);
    if (error) return fromPgError(error);
    return ok({ detached: service_id });
  },
});
