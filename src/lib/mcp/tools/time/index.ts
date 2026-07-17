import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid, zIsoDateTime } from "../../_shared/zod-common";

export const startDemandTimerTool = defineTool({
  name: "start_demand_timer",
  title: "Start demand timer",
  description: "Start a timer on a demand for the current user. Any previously running timer for this user is auto-closed.",
  inputSchema: { demand_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const now = new Date().toISOString();

    // Close any open timers for this user
    const { data: openTimers } = await client.from("demand_time_entries")
      .select("id, started_at").eq("user_id", ctx.getUserId()).is("ended_at", null);
    if (openTimers?.length) {
      for (const t of openTimers) {
        const duration = Math.floor((Date.now() - new Date(t.started_at).getTime()) / 1000);
        await client.from("demand_time_entries").update({ ended_at: now, duration_seconds: duration }).eq("id", t.id);
      }
    }

    const { data, error } = await client.from("demand_time_entries")
      .insert({ demand_id, user_id: ctx.getUserId(), started_at: now }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ timer: data, closed_previous: openTimers?.length ?? 0 });
  },
});

export const stopDemandTimerTool = defineTool({
  name: "stop_demand_timer",
  title: "Stop demand timer",
  description: "Stop the active timer for the current user (optionally scoped to a demand).",
  inputSchema: { demand_id: zUuid.optional() },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    let q = client.from("demand_time_entries").select("id, started_at").eq("user_id", ctx.getUserId()).is("ended_at", null);
    if (demand_id) q = q.eq("demand_id", demand_id);
    const { data: openTimers, error } = await q;
    if (error) return fromPgError(error);
    if (!openTimers?.length) return err("NOT_FOUND", "No active timer");
    const now = new Date().toISOString();
    const results = [];
    for (const t of openTimers) {
      const duration = Math.floor((Date.now() - new Date(t.started_at).getTime()) / 1000);
      const { data } = await client.from("demand_time_entries").update({ ended_at: now, duration_seconds: duration }).eq("id", t.id).select().maybeSingle();
      results.push(data);
    }
    return okUpdated({ stopped: results });
  },
});

export const getActiveTimerTool = defineTool({
  name: "get_active_timer",
  title: "Get active timer",
  description: "Return the current user's active timer, if any.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_time_entries")
      .select("*").eq("user_id", ctx.getUserId()).is("ended_at", null).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ timer: data });
  },
});

export const listTimeEntriesTool = defineTool({
  name: "list_time_entries",
  title: "List time entries",
  description: "List time entries by demand or user, optionally filtered by date range.",
  inputSchema: {
    demand_id: zUuid.optional(),
    user_id: zUuid.optional(),
    from: zIsoDateTime.optional(),
    to: zIsoDateTime.optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, user_id, from, to, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("demand_time_entries").select("*").order("started_at", { ascending: false }).limit(limit ?? 100);
    if (demand_id) q = q.eq("demand_id", demand_id);
    if (user_id) q = q.eq("user_id", user_id);
    if (from) q = q.gte("started_at", from);
    if (to) q = q.lte("started_at", to);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("entries", data ?? []);
  },
});

export const logTimeEntryTool = defineTool({
  name: "log_time_entry",
  title: "Log manual time entry",
  description: "Record a completed time entry manually (started_at/ended_at).",
  inputSchema: {
    demand_id: zUuid,
    started_at: zIsoDateTime,
    ended_at: zIsoDateTime,
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id, started_at, ended_at }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const dur = Math.floor((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000);
    if (dur <= 0) return err("VALIDATION", "ended_at must be after started_at");
    const { data, error } = await sb(ctx).from("demand_time_entries")
      .insert({ demand_id, user_id: ctx.getUserId(), started_at, ended_at, duration_seconds: dur })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ entry: data });
  },
});
