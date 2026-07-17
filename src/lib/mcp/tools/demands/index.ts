import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid, zPriority, zIsoDate, zAeiouOrigin } from "../../_shared/zod-common";

const DEMAND_COLS = "id, title, description, status_id, board_id, team_id, due_date, priority, board_sequence_number, service_id, parent_demand_id, is_overdue, archived, delivered_at, created_by, created_at, updated_at";

export const listDemandsTool = defineTool({
  name: "list_demands",
  title: "List demands",
  description: "List demands on a board. Optional filters: status_id, priority, assignee, limit.",
  inputSchema: {
    board_id: zUuid,
    status_id: zUuid.optional(),
    priority: zPriority.optional(),
    include_archived: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, status_id, priority, include_archived, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("demands").select(DEMAND_COLS)
      .eq("board_id", board_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status_id) q = q.eq("status_id", status_id);
    if (priority) q = q.eq("priority", priority);
    if (!include_archived) q = q.eq("archived", false);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("demands", data ?? []);
  },
});

export const searchDemandsTool = defineTool({
  name: "search_demands",
  title: "Search demands",
  description: "Search demands by title/description across accessible boards. Use to resolve names into IDs.",
  inputSchema: {
    query: z.string().trim().min(1).max(200),
    team_id: zUuid.optional(),
    board_id: zUuid.optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, team_id, board_id, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("demands").select(DEMAND_COLS)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .eq("archived", false)
      .limit(limit ?? 25);
    if (team_id) q = q.eq("team_id", team_id);
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("demands", data ?? []);
  },
});

export const getDemandTool = defineTool({
  name: "get_demand",
  title: "Get demand",
  description: "Fetch a single demand with its assignees, board and status.",
  inputSchema: { demand_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const [{ data: demand, error }, { data: assignees }] = await Promise.all([
      client.from("demands").select("*").eq("id", demand_id).maybeSingle(),
      client.from("demand_assignees").select("user_id, is_primary, profiles(id, full_name, avatar_url)").eq("demand_id", demand_id),
    ]);
    if (error) return fromPgError(error);
    if (!demand) return err("NOT_FOUND", "Demand not found");
    return ok({ demand, assignees: assignees ?? [] }, { open_url: urls.demand(demand_id) });
  },
});

export const createDemandTool = defineTool({
  name: "create_demand",
  title: "Create demand",
  description: "Create a demand on a board. If status_id is omitted, the board default is used. Optional assignees and AEIOU origin.",
  inputSchema: {
    board_id: zUuid,
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20000).optional(),
    status_id: zUuid.optional(),
    due_date: zIsoDate.optional(),
    priority: zPriority.optional(),
    service_id: zUuid.optional(),
    responsible_user_id: zUuid.optional().describe("Primary responsible (is_primary=true)."),
    follower_user_ids: z.array(zUuid).max(20).optional(),
    aeiou_origin: zAeiouOrigin.optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);

    // Resolve board team + default status
    const { data: board, error: bErr } = await client.from("boards").select("id, team_id").eq("id", input.board_id).maybeSingle();
    if (bErr) return fromPgError(bErr);
    if (!board) return err("NOT_FOUND", "Board not found");

    let status_id = input.status_id;
    if (!status_id) {
      const { data: st } = await client.from("board_statuses").select("id").eq("board_id", input.board_id).order("position").limit(1).maybeSingle();
      status_id = st?.id;
      if (!status_id) return err("VALIDATION", "Board has no statuses");
    }

    const patch: Record<string, unknown> = {
      board_id: input.board_id,
      team_id: board.team_id,
      title: input.title,
      description: input.description,
      status_id,
      due_date: input.due_date,
      priority: input.priority,
      service_id: input.service_id,
      created_by: ctx.getUserId(),
    };
    if (input.aeiou_origin) (patch as any).aeiou_origin = input.aeiou_origin;
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);

    const { data: demand, error } = await client.from("demands").insert(patch).select().maybeSingle();
    if (error) return fromPgError(error);
    if (!demand) return err("DB_ERROR", "Insert returned no row");

    // Assignees
    const rows: Array<{ demand_id: string; user_id: string; is_primary: boolean }> = [];
    if (input.responsible_user_id) rows.push({ demand_id: demand.id, user_id: input.responsible_user_id, is_primary: true });
    for (const uid of input.follower_user_ids ?? []) if (uid !== input.responsible_user_id) rows.push({ demand_id: demand.id, user_id: uid, is_primary: false });
    if (rows.length) {
      const { error: aErr } = await client.from("demand_assignees").insert(rows);
      if (aErr) return okCreated({ demand, warnings: [`Assignees not linked: ${aErr.message}`] }, { open_url: urls.demand(demand.id) });
    }

    return okCreated({ demand }, { open_url: urls.demand(demand.id) });
  },
});

export const updateDemandTool = defineTool({
  name: "update_demand",
  title: "Update demand",
  description: "Update demand fields (title, description, due_date, priority, service_id).",
  inputSchema: {
    demand_id: zUuid,
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(20000).optional(),
    due_date: zIsoDate.nullable().optional(),
    priority: zPriority.optional(),
    service_id: zUuid.nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id, ...patch }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    Object.keys(patch).forEach(k => (patch as any)[k] === undefined && delete (patch as any)[k]);
    if (!Object.keys(patch).length) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("demands").update(patch).eq("id", demand_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ demand: data }, { open_url: urls.demand(demand_id) });
  },
});

export const moveDemandTool = defineTool({
  name: "move_demand",
  title: "Move demand (change status)",
  description: "Move a demand to a different status column on its board.",
  inputSchema: { demand_id: zUuid, status_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, status_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demands")
      .update({ status_id, status_changed_at: new Date().toISOString(), status_changed_by: ctx.getUserId() })
      .eq("id", demand_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ demand: data }, { open_url: urls.demand(demand_id) });
  },
});

export const assignDemandTool = defineTool({
  name: "assign_demand",
  title: "Assign responsible",
  description: "Set the primary responsible for a demand. Any previous primary becomes a follower.",
  inputSchema: { demand_id: zUuid, user_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, user_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    // Demote current primary → follower
    const { error: e1 } = await client.from("demand_assignees").update({ is_primary: false })
      .eq("demand_id", demand_id).eq("is_primary", true);
    if (e1) return fromPgError(e1);
    // Upsert new primary
    const { data, error } = await client.from("demand_assignees")
      .upsert({ demand_id, user_id, is_primary: true }, { onConflict: "demand_id,user_id" })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ assignee: data }, { open_url: urls.demand(demand_id) });
  },
});

export const addFollowerTool = defineTool({
  name: "add_follower",
  title: "Add follower",
  description: "Add a follower (non-primary assignee) to a demand.",
  inputSchema: { demand_id: zUuid, user_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, user_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_assignees")
      .upsert({ demand_id, user_id, is_primary: false }, { onConflict: "demand_id,user_id" })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ assignee: data });
  },
});

export const removeFollowerTool = defineTool({
  name: "remove_follower",
  title: "Remove follower",
  description: "Remove a follower (non-primary) from a demand.",
  inputSchema: { demand_id: zUuid, user_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, user_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("demand_assignees").delete()
      .eq("demand_id", demand_id).eq("user_id", user_id).eq("is_primary", false);
    if (error) return fromPgError(error);
    return okDeleted(user_id);
  },
});

export const addDependencyTool = defineTool({
  name: "add_dependency",
  title: "Add demand dependency",
  description: "Declare that one demand depends on (is blocked by) another.",
  inputSchema: { demand_id: zUuid, depends_on_demand_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, depends_on_demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_dependencies")
      .insert({ demand_id, depends_on_demand_id }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ dependency: data });
  },
});

export const archiveDemandTool = defineTool({
  name: "archive_demand",
  title: "Archive demand",
  description: "Archive a demand (reversible — removes from active views).",
  inputSchema: { demand_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demands")
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", demand_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ demand: data });
  },
});

export const deleteDemandTool = defineTool({
  name: "delete_demand",
  title: "Delete demand (irreversible)",
  description: "Permanently delete a demand. Requires the user to have destructive permission.",
  inputSchema: { demand_id: zUuid, confirm: z.literal(true).describe("Must be `true` to confirm.") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("demands").delete().eq("id", demand_id);
    if (error) return fromPgError(error);
    return okDeleted(demand_id);
  },
});

export const createDemandWithSubdemandsTool = defineTool({
  name: "create_demand_with_subdemands",
  title: "Create demand with subdemands",
  description: "Atomically create a parent demand and its subdemands (and optional dependencies) using the SoMA+ RPC.",
  inputSchema: {
    parent: z.object({
      board_id: zUuid,
      title: z.string().min(1).max(500),
      description: z.string().max(20000).optional(),
      due_date: zIsoDate.optional(),
      priority: zPriority.optional(),
      service_id: zUuid.optional(),
      status_id: zUuid.optional(),
    }),
    subdemands: z.array(z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(20000).optional(),
      due_date: zIsoDate.optional(),
      priority: zPriority.optional(),
      service_id: zUuid.optional(),
    })).max(50).optional(),
    dependencies: z.array(z.object({
      demand_index: z.number().int().min(0),
      depends_on_index: z.number().int().min(0),
    })).max(100).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ parent, subdemands, dependencies }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).rpc("create_demand_with_subdemands", {
      p_parent: parent as any, p_subdemands: (subdemands ?? []) as any, p_dependencies: (dependencies ?? []) as any,
    });
    if (error) return fromPgError(error);
    return okCreated({ result: data });
  },
});
