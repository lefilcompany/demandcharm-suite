import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const startTimerTool = defineTool({
  name: "start_demand_timer",
  title: "Start demand timer",
  description: "Start a time entry on a demand for the caller. Stops any previously active entry.",
  inputSchema: { demand_id: z.string().uuid() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const now = new Date().toISOString();
    // Close any open entries for this user
    await c.from("demand_time_entries").update({ ended_at: now }).eq("user_id", ctx.getUserId()).is("ended_at", null);
    const { data, error } = await c.from("demand_time_entries").insert({ demand_id, user_id: ctx.getUserId(), started_at: now }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ entry: data });
  },
});

export const stopTimerTool = defineTool({
  name: "stop_demand_timer",
  title: "Stop demand timer",
  description: "Stop the caller's currently active time entry on a demand.",
  inputSchema: { demand_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    let q = c.from("demand_time_entries").update({ ended_at: new Date().toISOString() }).eq("user_id", ctx.getUserId()).is("ended_at", null);
    if (demand_id) q = q.eq("demand_id", demand_id);
    const { data, error } = await q.select();
    if (error) return fromPgError(error);
    return ok({ stopped: data ?? [] });
  },
});

export const getActiveTimerTool = defineTool({
  name: "get_active_timer",
  title: "Get active timer",
  description: "Return the caller's currently-running time entry, if any.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async (_i, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_time_entries")
      .select("*, demands(id, title, board_id)").eq("user_id", ctx.getUserId()).is("ended_at", null).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ entry: data });
  },
});

export const listTimeEntriesTool = defineTool({
  name: "list_demand_time_entries",
  title: "List time entries",
  description: "List time entries for a demand.",
  inputSchema: { demand_id: z.string().uuid(), limit: z.number().int().min(1).max(200).default(100) },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_time_entries")
      .select("*, profiles(id, full_name)").eq("demand_id", demand_id).order("started_at", { ascending: false }).limit(limit);
    if (error) return fromPgError(error);
    return ok({ entries: data ?? [] });
  },
});

export const manualTimeEntryTool = defineTool({
  name: "manual_time_entry",
  title: "Manual time entry",
  description: "Create a completed time entry with explicit start/end. Duration is computed by the database.",
  inputSchema: {
    demand_id: z.string().uuid(),
    started_at: z.string().datetime({ offset: true }),
    ended_at: z.string().datetime({ offset: true }),
    note: z.string().max(500).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async ({ demand_id, started_at, ended_at, note }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const duration = Math.max(0, Math.floor((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 1000));
    const { data, error } = await sb(ctx).from("demand_time_entries")
      .insert({ demand_id, user_id: ctx.getUserId(), started_at, ended_at, duration_seconds: duration, note: note ?? null }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ entry: data });
  },
});
