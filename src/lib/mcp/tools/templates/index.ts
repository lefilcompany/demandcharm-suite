import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid, zPriority } from "../../_shared/zod-common";

export const listTemplatesTool = defineTool({
  name: "list_templates",
  title: "List demand templates",
  description: "List reusable demand templates for a team.",
  inputSchema: { team_id: zUuid, board_id: zUuid.optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, board_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("demand_templates").select("*").eq("team_id", team_id).order("name");
    if (board_id) q = q.eq("board_id", board_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("templates", data ?? []);
  },
});

export const getTemplateTool = defineTool({
  name: "get_template",
  title: "Get template",
  description: "Fetch a template by id.",
  inputSchema: { template_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ template_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_templates").select("*").eq("id", template_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Template not found");
    return ok({ template: data });
  },
});

export const createTemplateTool = defineTool({
  name: "create_template",
  title: "Create template",
  description: "Create a reusable demand template.",
  inputSchema: {
    team_id: zUuid,
    board_id: zUuid,
    name: z.string().min(1).max(200),
    title_template: z.string().min(1).max(500),
    description_template: z.string().max(20000).optional(),
    priority: zPriority.optional(),
    service_id: zUuid.optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_templates").insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ template: data });
  },
});

export const updateTemplateTool = defineTool({
  name: "update_template",
  title: "Update template",
  description: "Update fields of a template.",
  inputSchema: {
    template_id: zUuid,
    name: z.string().min(1).max(200).optional(),
    title_template: z.string().min(1).max(500).optional(),
    description_template: z.string().max(20000).optional(),
    priority: zPriority.optional(),
    service_id: zUuid.nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ template_id, ...patch }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    Object.keys(patch).forEach(k => (patch as any)[k] === undefined && delete (patch as any)[k]);
    if (!Object.keys(patch).length) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("demand_templates").update(patch).eq("id", template_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ template: data });
  },
});

export const deleteTemplateTool = defineTool({
  name: "delete_template",
  title: "Delete template",
  description: "Delete a template.",
  inputSchema: { template_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ template_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("demand_templates").delete().eq("id", template_id);
    if (error) return fromPgError(error);
    return okDeleted(template_id);
  },
});
