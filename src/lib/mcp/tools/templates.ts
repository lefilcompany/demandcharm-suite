import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listTemplatesTool = defineTool({
  name: "list_templates",
  title: "List demand templates",
  description: "List demand templates.",
  inputSchema: { team_id: z.string().uuid(), board_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ team_id, board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("demand_templates").select("*").eq("team_id", team_id).order("name");
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ templates: data ?? [] });
  },
});

export const getTemplateTool = defineTool({
  name: "get_template",
  title: "Get template",
  description: "Get template.",
  inputSchema: { template_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ template_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_templates").select("*").eq("id", template_id).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ template: data });
  },
});

export const listRecurringDemandsTool = defineTool({
  name: "list_recurring_demands",
  title: "List recurring demands",
  description: "List recurring demands.",
  inputSchema: { team_id: z.string().uuid().optional(), board_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ team_id, board_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("recurring_demands").select("*").order("created_at", { ascending: false });
    if (team_id) q = q.eq("team_id", team_id);
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ recurring: data ?? [] });
  },
});

export const pauseRecurringDemandTool = defineTool({
  name: "pause_recurring_demand",
  title: "Pause/resume recurring demand",
  description: "Pause/resume recurring demand.",
  inputSchema: { recurring_id: z.string().uuid(), is_active: z.boolean() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ recurring_id, is_active }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("recurring_demands").update({ is_active }).eq("id", recurring_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ recurring: data });
  },
});
