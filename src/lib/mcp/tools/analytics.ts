import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const boardSummaryStatsTool = defineTool({
  name: "board_summary_stats",
  title: "Board summary stats",
  description: "Aggregate counters for a board: total, delivered, overdue, in-progress, by status, by assignee.",
  inputSchema: {
    board_id: z.string().uuid(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id, from, to }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    let q = c.from("demands").select("id, status_id, is_overdue, delivered_at, created_at, priority").eq("board_id", board_id).eq("archived", false);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    const list = data ?? [];
    const byStatus: Record<string, number> = {};
    for (const d of list) byStatus[d.status_id] = (byStatus[d.status_id] ?? 0) + 1;
    return ok({
      total: list.length,
      delivered: list.filter((d) => d.delivered_at).length,
      overdue: list.filter((d) => d.is_overdue).length,
      by_status: byStatus,
      by_priority: list.reduce<Record<string, number>>((acc, d) => { acc[d.priority] = (acc[d.priority] ?? 0) + 1; return acc; }, {}),
    });
  },
});

export const demandsByPeriodTool = defineTool({
  name: "demands_by_period",
  title: "Demands by period",
  description: "Count demands created per day between two dates (bounded to 90 days).",
  inputSchema: {
    board_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id, team_id, from, to }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("demands").select("created_at, delivered_at").gte("created_at", from).lte("created_at", to).eq("archived", false);
    if (board_id) q = q.eq("board_id", board_id);
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    const created: Record<string, number> = {}; const delivered: Record<string, number> = {};
    for (const d of data ?? []) {
      const c = d.created_at.substring(0, 10); created[c] = (created[c] ?? 0) + 1;
      if (d.delivered_at) { const dd = d.delivered_at.substring(0, 10); delivered[dd] = (delivered[dd] ?? 0) + 1; }
    }
    return ok({ created_by_day: created, delivered_by_day: delivered });
  },
});

export const overdueDemandsTool = defineTool({
  name: "overdue_demands",
  title: "List overdue demands",
  description: "List overdue demands.",
  inputSchema: {
    board_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ board_id, team_id, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("demands").select("id, title, due_date, priority, board_id, status_id").eq("is_overdue", true).eq("archived", false).order("due_date").limit(limit);
    if (board_id) q = q.eq("board_id", board_id);
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ demands: data ?? [] });
  },
});

export const userProductivityTool = defineTool({
  name: "user_productivity_stats",
  title: "User productivity stats",
  description: "Aggregate time worked and deliveries for the caller (or a target user) over a period.",
  inputSchema: {
    user_id: z.string().uuid().optional().describe("Defaults to the caller."),
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ user_id, from, to }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const uid = user_id ?? ctx.getUserId()!;
    const c = sb(ctx);
    const [{ data: entries }, { data: assignments }] = await Promise.all([
      c.from("demand_time_entries").select("duration_seconds, demand_id").eq("user_id", uid).gte("started_at", from).lte("started_at", to),
      c.from("demand_assignees").select("demand_id, is_primary, demands(delivered_at)").eq("user_id", uid),
    ]);
    const total_seconds = (entries ?? []).reduce((a, e) => a + (e.duration_seconds ?? 0), 0);
    const delivered = (assignments ?? []).filter((a) => {
      const dd = (a as { demands?: { delivered_at?: string | null } }).demands?.delivered_at;
      return dd && dd >= from && dd <= to;
    }).length;
    return ok({ user_id: uid, total_seconds, entries_count: entries?.length ?? 0, delivered_count: delivered });
  },
});
