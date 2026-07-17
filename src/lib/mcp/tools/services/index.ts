import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, okDeleted, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid } from "../../_shared/zod-common";

export const listServicesTool = defineTool({
  name: "list_services",
  title: "List services",
  description: "List services registered by a team (catalog of deliverables).",
  inputSchema: { team_id: zUuid, parent_id: zUuid.nullable().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id, parent_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("services").select("*").eq("team_id", team_id).order("name");
    if (parent_id !== undefined) q = q.is("parent_id", parent_id ?? null as any);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("services", data ?? []);
  },
});

export const getServiceTool = defineTool({
  name: "get_service",
  title: "Get service",
  description: "Fetch a service by id.",
  inputSchema: { service_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ service_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("services").select("*").eq("id", service_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Service not found");
    return ok({ service: data }, { open_url: urls.service(service_id) });
  },
});

export const createServiceTool = defineTool({
  name: "create_service",
  title: "Create service",
  description: "Create a new service in a team catalog.",
  inputSchema: {
    team_id: zUuid,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    estimated_hours: z.number().min(0).max(10000).optional(),
    price_cents: z.number().int().min(0).optional(),
    parent_id: zUuid.optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("services")
      .insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ service: data });
  },
});

export const updateServiceTool = defineTool({
  name: "update_service",
  title: "Update service",
  description: "Update a service's fields.",
  inputSchema: {
    service_id: zUuid,
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    estimated_hours: z.number().min(0).optional(),
    price_cents: z.number().int().min(0).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ service_id, ...patch }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    Object.keys(patch).forEach(k => (patch as any)[k] === undefined && delete (patch as any)[k]);
    if (!Object.keys(patch).length) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("services").update(patch).eq("id", service_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ service: data });
  },
});

export const deleteServiceTool = defineTool({
  name: "delete_service",
  title: "Delete service",
  description: "Delete a service. Fails if the service is referenced by demands.",
  inputSchema: { service_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ service_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("services").delete().eq("id", service_id);
    if (error) return fromPgError(error);
    return okDeleted(service_id);
  },
});
