import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid } from "../../_shared/zod-common";

/** Cheap in-handler aggregations. When a proper SQL function is available, prefer it. */

export const boardSummaryStatsTool = defineTool({
  name: "board_summary_stats",
  title: "Board summary stats",
  description: "Return demand counts by status, priority, overdue and delivered for a board.",
  inputSchema: { board_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const [{ data: demands, error }, { data: statuses }] = await Promise.all([
      client.from("demands").select("id, status_id, priority, is_overdue, delivered_at, archived").eq("board_id", board_id).eq("archived", false),
      client.from("board_statuses").select("id, name").eq("board_id", board_id),
    ]);
    if (error) return fromPgError(error);
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let overdue = 0, delivered = 0, active = 0;
    for (const d of demands ?? []) {
      byStatus[d.status_id] = (byStatus[d.status_id] ?? 0) + 1;
      if (d.priority) byPriority[d.priority] = (byPriority[d.priority] ?? 0) + 1;
      if (d.is_overdue) overdue++;
      if (d.delivered_at) delivered++; else active++;
    }
    const status_map = Object.fromEntries((statuses ?? []).map(s => [s.id, s.name]));
    return ok({
      board_id,
      counts: { total: demands?.length ?? 0, active, delivered, overdue },
      by_status: Object.entries(byStatus).map(([id, n]) => ({ status_id: id, status_name: status_map[id] ?? "?", count: n })),
      by_priority: byPriority,
    }, { open_url: urls.board(board_id) });
  },
});

export const overdueDemandsTool = defineTool({
  name: "overdue_demands",
  title: "Overdue demands",
  description: "List demands whose deadline has passed and that are not yet delivered.",
  inputSchema: { board_id: zUuid.optional(), team_id: zUuid.optional(), limit: z.number().int().min(1).max(200).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, team_id, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("demands")
      .select("id, title, board_id, team_id, due_date, priority, status_id, is_overdue")
      .eq("is_overdue", true).eq("archived", false).is("delivered_at", null)
      .order("due_date", { ascending: true }).limit(limit ?? 50);
    if (board_id) q = q.eq("board_id", board_id);
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("overdue", data ?? []);
  },
});

export const dueSoonDemandsTool = defineTool({
  name: "due_soon_demands",
  title: "Due-soon demands",
  description: "List demands due within a window (default 7 days) and not yet delivered.",
  inputSchema: {
    board_id: zUuid.optional(),
    team_id: zUuid.optional(),
    window_days: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, team_id, window_days, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const days = window_days ?? 7;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const end = new Date(today); end.setUTCDate(end.getUTCDate() + days);
    let q = sb(ctx).from("demands")
      .select("id, title, board_id, team_id, due_date, priority, status_id")
      .eq("archived", false).is("delivered_at", null)
      .gte("due_date", today.toISOString().slice(0, 10))
      .lte("due_date", end.toISOString().slice(0, 10))
      .order("due_date").limit(limit ?? 50);
    if (board_id) q = q.eq("board_id", board_id);
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("due_soon", data ?? []);
  },
});

export const getOperationalSnapshotTool = defineTool({
  name: "get_operational_snapshot",
  title: "Operational snapshot",
  description: "One-shot aggregated read of a board/team: totals, overdue, due-soon, capacity by user, bottleneck alerts.",
  inputSchema: {
    board_id: zUuid.optional(),
    team_id: zUuid.optional(),
    window_days: z.number().int().min(1).max(60).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, team_id, window_days }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    if (!board_id && !team_id) return { content: [{ type: "text", text: "VALIDATION: board_id or team_id required" }], isError: true } as any;
    const client = sb(ctx);
    const days = window_days ?? 7;

    let q = client.from("demands").select("id, title, status_id, priority, due_date, is_overdue, delivered_at, board_id, team_id, archived");
    if (board_id) q = q.eq("board_id", board_id);
    if (team_id) q = q.eq("team_id", team_id);
    q = q.eq("archived", false);
    const { data: demands, error } = await q;
    if (error) return fromPgError(error);

    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(); end.setUTCDate(end.getUTCDate() + days);
    const endStr = end.toISOString().slice(0, 10);

    let active = 0, delivered = 0, overdue = 0, due_soon = 0;
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const d of demands ?? []) {
      if (d.delivered_at) delivered++; else active++;
      if (d.is_overdue && !d.delivered_at) overdue++;
      if (!d.delivered_at && d.due_date && d.due_date >= today && d.due_date <= endStr) due_soon++;
      byStatus[d.status_id] = (byStatus[d.status_id] ?? 0) + 1;
      if (d.priority && d.priority in byPriority) byPriority[d.priority]++;
    }

    // Capacity by assignee (active only)
    const activeIds = (demands ?? []).filter(d => !d.delivered_at).map(d => d.id);
    let byUser: Array<{ user_id: string; active_count: number; overdue_count: number }> = [];
    if (activeIds.length) {
      const { data: assignees } = await client.from("demand_assignees")
        .select("user_id, demand_id, is_primary").in("demand_id", activeIds).eq("is_primary", true);
      const map: Record<string, { active: number; overdue: number }> = {};
      const overdueSet = new Set((demands ?? []).filter(d => d.is_overdue && !d.delivered_at).map(d => d.id));
      for (const a of assignees ?? []) {
        map[a.user_id] ??= { active: 0, overdue: 0 };
        map[a.user_id].active++;
        if (overdueSet.has(a.demand_id)) map[a.user_id].overdue++;
      }
      byUser = Object.entries(map).map(([user_id, v]) => ({ user_id, active_count: v.active, overdue_count: v.overdue }))
        .sort((a, b) => b.active_count - a.active_count);
    }

    const alerts: string[] = [];
    if (overdue > 0) alerts.push(`${overdue} demanda(s) atrasada(s).`);
    if (due_soon > 0) alerts.push(`${due_soon} demanda(s) vencem nos próximos ${days} dia(s).`);
    if (byPriority.urgent > 0) alerts.push(`${byPriority.urgent} demanda(s) marcada(s) como urgentes.`);

    const status: "ok" | "atencao" | "risco" = overdue > 5 ? "risco" : overdue > 0 || due_soon > 5 ? "atencao" : "ok";

    return ok({
      status,
      scope: { board_id: board_id ?? null, team_id: team_id ?? null },
      period: { window_days: days, from: today, to: endStr },
      counts: { total: demands?.length ?? 0, active, delivered, overdue, due_soon },
      by_status: byStatus,
      by_priority: byPriority,
      capacity_by_user: byUser.slice(0, 20),
      alerts,
    });
  },
});

export const riskOfDelayTool = defineTool({
  name: "risk_of_delay",
  title: "Risk of delay",
  description: "Demands at risk of missing their deadline: due-soon, without recent activity, or blocked by dependencies.",
  inputSchema: {
    board_id: zUuid.optional(),
    team_id: zUuid.optional(),
    window_days: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ board_id, team_id, window_days, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const days = window_days ?? 7;
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(); end.setUTCDate(end.getUTCDate() + days);
    let q = sb(ctx).from("demands")
      .select("id, title, board_id, due_date, priority, status_id, updated_at")
      .eq("archived", false).is("delivered_at", null)
      .lte("due_date", end.toISOString().slice(0, 10))
      .gte("due_date", today)
      .order("due_date").limit(limit ?? 100);
    if (board_id) q = q.eq("board_id", board_id);
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    const staleThreshold = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const items = (data ?? []).map(d => ({
      ...d,
      risk_signals: [
        d.priority === "urgent" || d.priority === "high" ? "high_priority" : null,
        new Date(d.updated_at).getTime() < staleThreshold ? "no_recent_activity" : null,
      ].filter(Boolean),
    }));
    return okList("at_risk", items);
  },
});

export const userProductivityStatsTool = defineTool({
  name: "user_productivity_stats",
  title: "User productivity stats",
  description: "Deliveries and time invested by a user over a period.",
  inputSchema: {
    user_id: zUuid,
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ user_id, from, to }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const [{ data: entries }, { data: delivered }] = await Promise.all([
      client.from("demand_time_entries").select("duration_seconds").eq("user_id", user_id).gte("started_at", from).lte("started_at", to),
      client.from("demands").select("id").eq("assigned_to", user_id).not("delivered_at", "is", null).gte("delivered_at", from).lte("delivered_at", to),
    ]);
    const totalSeconds = (entries ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
    return ok({
      user_id, period: { from, to },
      total_time_seconds: totalSeconds,
      total_time_hours: Math.round(totalSeconds / 36) / 100,
      delivered_count: delivered?.length ?? 0,
    });
  },
});
