import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid, zPriority, zIsoDate } from "../../_shared/zod-common";

export const listRecurringDemandsTool = defineTool({
  name: "list_recurring_demands",
  title: "List recurring demands",
  description: "List recurring demand templates for a team.",
  inputSchema: { team_id: zUuid, only_active: z.boolean().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, only_active }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("recurring_demands").select("*").eq("team_id", team_id).order("title");
    if (only_active) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("recurring", data ?? []);
  },
});

export const getRecurringDemandTool = defineTool({
  name: "get_recurring_demand",
  title: "Get recurring demand",
  description: "Fetch a recurring demand by id.",
  inputSchema: { recurring_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ recurring_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("recurring_demands").select("*").eq("id", recurring_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Recurring demand not found");
    return ok({ recurring: data });
  },
});

const zFrequency = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const createRecurringDemandTool = defineTool({
  name: "create_recurring_demand",
  title: "Create recurring demand",
  description: "Set up a recurring demand that auto-generates on a schedule.",
  inputSchema: {
    team_id: zUuid,
    board_id: zUuid,
    status_id: zUuid,
    title: z.string().min(1).max(500),
    description: z.string().max(20000).optional(),
    priority: zPriority.optional(),
    service_id: zUuid.optional(),
    frequency: zFrequency,
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional().describe("For weekly: 0=Sunday .. 6=Saturday."),
    day_of_month: z.number().int().min(1).max(31).optional().describe("For monthly/yearly."),
    start_date: zIsoDate,
    end_date: zIsoDate.optional(),
    assignee_ids: z.array(zUuid).max(20).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("recurring_demands")
      .insert({ ...input, created_by: ctx.getUserId(), is_active: true }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ recurring: data });
  },
});

export const updateRecurringDemandTool = defineTool({
  name: "update_recurring_demand",
  title: "Update recurring demand",
  description: "Update the schedule or fields of a recurring demand.",
  inputSchema: {
    recurring_id: zUuid,
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(20000).optional(),
    priority: zPriority.optional(),
    service_id: zUuid.nullable().optional(),
    frequency: zFrequency.optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    day_of_month: z.number().int().min(1).max(31).optional(),
    end_date: zIsoDate.nullable().optional(),
    assignee_ids: z.array(zUuid).max(20).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ recurring_id, ...patch }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    Object.keys(patch).forEach(k => (patch as any)[k] === undefined && delete (patch as any)[k]);
    if (!Object.keys(patch).length) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("recurring_demands").update(patch).eq("id", recurring_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ recurring: data });
  },
});

export const pauseRecurringTool = defineTool({
  name: "pause_recurring",
  title: "Pause recurring demand",
  description: "Pause a recurring demand (stops generating new demands).",
  inputSchema: { recurring_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ recurring_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("recurring_demands").update({ is_active: false }).eq("id", recurring_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ recurring: data });
  },
});

export const resumeRecurringTool = defineTool({
  name: "resume_recurring",
  title: "Resume recurring demand",
  description: "Resume a paused recurring demand.",
  inputSchema: { recurring_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ recurring_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("recurring_demands").update({ is_active: true }).eq("id", recurring_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ recurring: data });
  },
});

export const deleteRecurringTool = defineTool({
  name: "delete_recurring",
  title: "Delete recurring demand",
  description: "Delete a recurring demand (does not remove already-generated demands).",
  inputSchema: { recurring_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ recurring_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("recurring_demands").delete().eq("id", recurring_id);
    if (error) return fromPgError(error);
    return okDeleted(recurring_id);
  },
});
