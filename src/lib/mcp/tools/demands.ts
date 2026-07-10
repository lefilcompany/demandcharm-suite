import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError, err } from "../_shared/supabase";

const priority = z.enum(["baixa", "média", "alta", "urgente"]);

const demandFields = "id, title, description, board_id, team_id, status_id, priority, due_date, service_id, created_by, created_at, updated_at, delivered_at, archived, is_overdue, board_sequence_number, parent_demand_id";

async function resolveFirstStatus(client: ReturnType<typeof sb>, board_id: string) {
  const { data } = await client.from("board_statuses").select("status_id").eq("board_id", board_id).eq("is_active", true).order("position").limit(1).maybeSingle();
  return data?.status_id as string | undefined;
}

export const listDemandsTool = defineTool({
  name: "list_demands",
  title: "List demands",
  description: "Advanced demand listing with filters. Respects RLS.",
  inputSchema: {
    board_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    status_id: z.string().uuid().optional(),
    assignee_user_id: z.string().uuid().optional(),
    service_id: z.string().uuid().optional(),
    priority: priority.optional(),
    is_overdue: z.boolean().optional(),
    archived: z.boolean().default(false),
    parent_demand_id: z.string().uuid().optional().describe("Filter subdemands of a parent."),
    created_after: z.string().datetime({ offset: true }).optional(),
    created_before: z.string().datetime({ offset: true }).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (i, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    let ids: string[] | null = null;
    if (i.assignee_user_id) {
      const { data } = await c.from("demand_assignees").select("demand_id").eq("user_id", i.assignee_user_id);
      ids = (data ?? []).map((r) => r.demand_id);
      if (!ids.length) return ok({ demands: [] });
    }
    let q = c.from("demands").select(demandFields).order("created_at", { ascending: false }).limit(i.limit).eq("archived", i.archived);
    if (i.board_id) q = q.eq("board_id", i.board_id);
    if (i.team_id) q = q.eq("team_id", i.team_id);
    if (i.status_id) q = q.eq("status_id", i.status_id);
    if (i.service_id) q = q.eq("service_id", i.service_id);
    if (i.priority) q = q.eq("priority", i.priority);
    if (i.is_overdue !== undefined) q = q.eq("is_overdue", i.is_overdue);
    if (i.parent_demand_id) q = q.eq("parent_demand_id", i.parent_demand_id);
    if (i.created_after) q = q.gte("created_at", i.created_after);
    if (i.created_before) q = q.lte("created_at", i.created_before);
    if (ids) q = q.in("id", ids);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ demands: data ?? [] });
  },
});

export const searchDemandsTool = defineTool({
  name: "search_demands",
  title: "Search demands",
  description: "Full-text-ish search on title/description of demands (ilike). Supports #123 board sequence.",
  inputSchema: {
    query: z.string().min(1),
    board_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ query, board_id, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const seq = query.match(/^#?(\d+)$/);
    const escaped = query.replace(/[%_]/g, (m) => `\\${m}`);
    let q = sb(ctx).from("demands").select(demandFields).eq("archived", false).order("created_at", { ascending: false }).limit(limit);
    if (seq) q = q.eq("board_sequence_number", parseInt(seq[1]!, 10));
    else q = q.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ demands: data ?? [] });
  },
});

export const listMyDemandsTool = defineTool({
  name: "list_my_demands",
  title: "List my demands",
  description: "List demands where the caller is responsible or a follower.",
  inputSchema: {
    board_id: z.string().uuid().optional(),
    include_archived: z.boolean().default(false),
    only_primary: z.boolean().default(false).describe("Only demands where the user is the primary responsible."),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id, include_archived, only_primary, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    let aq = c.from("demand_assignees").select("demand_id, is_primary").eq("user_id", ctx.getUserId());
    if (only_primary) aq = aq.eq("is_primary", true);
    const { data: a, error: ae } = await aq;
    if (ae) return fromPgError(ae);
    const ids = (a ?? []).map((r) => r.demand_id);
    if (!ids.length) return ok({ demands: [] });
    let q = c.from("demands").select(demandFields).in("id", ids).order("created_at", { ascending: false }).limit(limit);
    if (!include_archived) q = q.eq("archived", false);
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ demands: data ?? [] });
  },
});

export const getDemandTool = defineTool({
  name: "get_demand",
  title: "Get demand (detailed)",
  description: "Fetch a demand with assignees, subtasks, dependencies and recent comments.",
  inputSchema: { demand_id: z.string().uuid(), comments_limit: z.number().int().min(0).max(100).default(20) },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id, comments_limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data: demand, error } = await c.from("demands").select(demandFields).eq("id", demand_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!demand) return err("Demand not found", "NOT_FOUND");
    const [{ data: assignees }, { data: subtasks }, { data: deps }, { data: comments }, { data: subdemands }] = await Promise.all([
      c.from("demand_assignees").select("user_id, is_primary, profiles(id, full_name, avatar_url)").eq("demand_id", demand_id),
      c.from("demand_subtasks").select("*").eq("demand_id", demand_id).order("position"),
      c.from("demand_dependencies").select("depends_on_demand_id").eq("demand_id", demand_id),
      c.from("demand_interactions").select("id, user_id, channel, content, created_at, profiles(full_name, avatar_url)").eq("demand_id", demand_id).order("created_at", { ascending: false }).limit(comments_limit),
      c.from("demands").select("id, title, status_id, subdemand_sort_order").eq("parent_demand_id", demand_id).order("subdemand_sort_order"),
    ]);
    return ok({ demand, assignees: assignees ?? [], subtasks: subtasks ?? [], dependencies: deps ?? [], comments: comments ?? [], subdemands: subdemands ?? [] });
  },
});

export const createDemandTool = defineTool({
  name: "create_demand",
  title: "Create demand",
  description: "Create a demand on a board. Defaults: caller as responsible, first active status. Supports followers.",
  inputSchema: {
    board_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().optional(),
    priority: priority.default("média"),
    due_date: z.string().datetime({ offset: true }).optional(),
    status_id: z.string().uuid().optional(),
    service_id: z.string().uuid().optional(),
    assignee_user_id: z.string().uuid().optional().describe("Primary responsible (defaults to caller)."),
    follower_ids: z.array(z.string().uuid()).optional().describe("Additional followers."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async (i, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const userId = ctx.getUserId()!;
    const { data: board, error: be } = await c.from("boards").select("id, team_id").eq("id", i.board_id).maybeSingle();
    if (be) return fromPgError(be);
    if (!board) return err("Board not found", "NOT_FOUND");
    const status_id = i.status_id ?? (await resolveFirstStatus(c, i.board_id));
    if (!status_id) return err("No active status found on this board", "VALIDATION");
    const { data: demand, error: de } = await c.from("demands").insert({
      board_id: i.board_id, team_id: board.team_id, status_id, title: i.title,
      description: i.description ?? null, priority: i.priority, due_date: i.due_date ?? null,
      service_id: i.service_id ?? null, created_by: userId,
    }).select(demandFields).single();
    if (de) return fromPgError(de);
    const primary = i.assignee_user_id ?? userId;
    const rows = [{ demand_id: demand.id, user_id: primary, is_primary: true }, ...((i.follower_ids ?? []).filter((u) => u !== primary).map((u) => ({ demand_id: demand.id, user_id: u, is_primary: false })))];
    const { error: ae } = await c.from("demand_assignees").insert(rows);
    if (ae) return ok({ demand, assignee_error: ae.message });
    return ok({ demand });
  },
});

export const createDemandWithSubdemandsTool = defineTool({
  name: "create_demand_with_subdemands",
  title: "Create demand with subdemands",
  description: "Create a parent demand plus multiple subdemands and dependencies between them (indices are 1-based within subdemands).",
  inputSchema: {
    parent: z.object({
      board_id: z.string().uuid(), team_id: z.string().uuid(),
      title: z.string().min(1), description: z.string().optional(),
      status_id: z.string().uuid(), priority: priority.optional(),
      assigned_to: z.string().uuid().optional(), due_date: z.string().datetime({ offset: true }).optional(),
      service_id: z.string().uuid().optional(),
    }),
    subdemands: z.array(z.object({
      title: z.string().min(1), description: z.string().optional(),
      status_id: z.string().uuid(), priority: priority.optional(),
      assigned_to: z.string().uuid().optional(), due_date: z.string().datetime({ offset: true }).optional(),
      service_id: z.string().uuid().optional(),
    })).default([]),
    dependencies: z.array(z.object({ demand_index: z.number().int().min(1), depends_on_index: z.number().int().min(1) })).default([]),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async (i, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).rpc("create_demand_with_subdemands", {
      p_parent: i.parent, p_subdemands: i.subdemands, p_dependencies: i.dependencies,
    });
    if (error) return fromPgError(error);
    return ok(data as Record<string, unknown>);
  },
});

export const updateDemandTool = defineTool({
  name: "update_demand",
  title: "Update demand",
  description: "Update demand fields (title, description, priority, due_date, service_id).",
  inputSchema: {
    demand_id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    priority: priority.optional(),
    due_date: z.string().datetime({ offset: true }).nullable().optional(),
    service_id: z.string().uuid().nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id, ...patch }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return ok({ updated: false });
    const { data, error } = await sb(ctx).from("demands").update(clean).eq("id", demand_id).select(demandFields).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ demand: data });
  },
});

export const changeDemandStatusTool = defineTool({
  name: "change_demand_status",
  title: "Change demand status",
  description: "Move a demand to a new status. Optionally propagates to subdemands.",
  inputSchema: {
    demand_id: z.string().uuid(),
    status_id: z.string().uuid(),
    propagate_to_subdemands: z.boolean().default(false),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id, status_id, propagate_to_subdemands }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data, error } = await c.from("demands").update({ status_id, status_changed_by: ctx.getUserId() }).eq("id", demand_id).select(demandFields).maybeSingle();
    if (error) return fromPgError(error);
    let propagated = null;
    if (propagate_to_subdemands) {
      const { data: p, error: pe } = await c.rpc("propagate_status_to_subdemands", { p_parent_id: demand_id, p_new_status_id: status_id });
      if (pe) return fromPgError(pe);
      propagated = p;
    }
    return ok({ demand: data, propagated });
  },
});

export const archiveDemandTool = defineTool({
  name: "archive_demand",
  title: "Archive demand",
  description: "Archive (soft-delete) or restore a demand.",
  inputSchema: { demand_id: z.string().uuid(), archived: z.boolean().default(true) },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  handler: async ({ demand_id, archived }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demands").update({ archived }).eq("id", demand_id).select(demandFields).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ demand: data });
  },
});

export const deleteDemandTool = defineTool({
  name: "delete_demand",
  title: "Delete demand",
  description: "Permanently delete a demand. Irreversible.",
  inputSchema: { demand_id: z.string().uuid(), confirm: z.literal(true) },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("demands").delete().eq("id", demand_id);
    if (error) return fromPgError(error);
    return ok({ deleted: demand_id });
  },
});

export const moveDemandToBoardTool = defineTool({
  name: "move_demand_to_board",
  title: "Move demand to another board",
  description: "Move a demand to a different board. A new board_sequence_number is auto-assigned.",
  inputSchema: { demand_id: z.string().uuid(), target_board_id: z.string().uuid(), status_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id, target_board_id, status_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data: board, error: be } = await c.from("boards").select("id, team_id").eq("id", target_board_id).maybeSingle();
    if (be) return fromPgError(be);
    if (!board) return err("Target board not found", "NOT_FOUND");
    const sid = status_id ?? (await resolveFirstStatus(c, target_board_id));
    if (!sid) return err("No active status on target board", "VALIDATION");
    const { data, error } = await c.from("demands").update({ board_id: target_board_id, team_id: board.team_id, status_id: sid }).eq("id", demand_id).select(demandFields).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ demand: data });
  },
});

// Assignees
export const listDemandAssigneesTool = defineTool({
  name: "list_demand_assignees",
  title: "List demand assignees",
  description: "List the responsible + followers of a demand.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_assignees").select("user_id, is_primary, profiles(id, full_name, avatar_url)").eq("demand_id", demand_id);
    if (error) return fromPgError(error);
    return ok({ assignees: data ?? [] });
  },
});

export const addDemandAssigneeTool = defineTool({
  name: "add_demand_assignee",
  title: "Add demand assignee",
  description: "Add a follower or set a primary responsible on a demand.",
  inputSchema: { demand_id: z.string().uuid(), user_id: z.string().uuid(), is_primary: z.boolean().default(false) },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id, user_id, is_primary }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    if (is_primary) {
      await c.from("demand_assignees").update({ is_primary: false }).eq("demand_id", demand_id).eq("is_primary", true);
    }
    const { data, error } = await c.from("demand_assignees")
      .upsert({ demand_id, user_id, is_primary }, { onConflict: "demand_id,user_id" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ assignee: data });
  },
});

export const setPrimaryAssigneeTool = defineTool({
  name: "set_primary_assignee",
  title: "Set primary assignee",
  description: "Promote a user to primary responsible on a demand (there is always exactly one primary).",
  inputSchema: { demand_id: z.string().uuid(), user_id: z.string().uuid() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id, user_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    await c.from("demand_assignees").update({ is_primary: false }).eq("demand_id", demand_id);
    const { data, error } = await c.from("demand_assignees")
      .upsert({ demand_id, user_id, is_primary: true }, { onConflict: "demand_id,user_id" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ assignee: data });
  },
});

export const removeDemandAssigneeTool = defineTool({
  name: "remove_demand_assignee",
  title: "Remove demand assignee",
  description: "Remove a follower from a demand (cannot leave the demand with 0 assignees).",
  inputSchema: { demand_id: z.string().uuid(), user_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ demand_id, user_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { count } = await c.from("demand_assignees").select("*", { count: "exact", head: true }).eq("demand_id", demand_id);
    if ((count ?? 0) <= 1) return err("A demanda deve ter pelo menos 1 assignee", "VALIDATION");
    const { error } = await c.from("demand_assignees").delete().eq("demand_id", demand_id).eq("user_id", user_id);
    if (error) return fromPgError(error);
    return ok({ removed: user_id });
  },
});

// Dependencies
export const listDemandDependenciesTool = defineTool({
  name: "list_demand_dependencies",
  title: "List demand dependencies",
  description: "List demands this demand depends on.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_dependencies")
      .select("depends_on_demand_id, demands!demand_dependencies_depends_on_demand_id_fkey(id, title, status_id)").eq("demand_id", demand_id);
    if (error) return fromPgError(error);
    return ok({ dependencies: data ?? [] });
  },
});

export const addDependencyTool = defineTool({
  name: "add_dependency",
  title: "Add demand dependency",
  description: "Make demand_id depend on depends_on_demand_id (must be delivered before demand_id can start).",
  inputSchema: { demand_id: z.string().uuid(), depends_on_demand_id: z.string().uuid() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id, depends_on_demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_dependencies")
      .insert({ demand_id, depends_on_demand_id }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ dependency: data });
  },
});

export const removeDependencyTool = defineTool({
  name: "remove_dependency",
  title: "Remove demand dependency",
  description: "Remove demand dependency.",
  inputSchema: { demand_id: z.string().uuid(), depends_on_demand_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ demand_id, depends_on_demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("demand_dependencies").delete().eq("demand_id", demand_id).eq("depends_on_demand_id", depends_on_demand_id);
    if (error) return fromPgError(error);
    return ok({ removed: depends_on_demand_id });
  },
});

export const reorderSubdemandsTool = defineTool({
  name: "reorder_subdemands",
  title: "Reorder subdemands",
  description: "Reorder subdemands of a parent by supplying the ordered list of ids.",
  inputSchema: { parent_demand_id: z.string().uuid(), ordered_ids: z.array(z.string().uuid()).min(1) },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ parent_demand_id, ordered_ids }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).rpc("reorder_subdemands", { p_parent_id: parent_demand_id, p_ordered_ids: ordered_ids });
    if (error) return fromPgError(error);
    return ok({ reordered: true });
  },
});
