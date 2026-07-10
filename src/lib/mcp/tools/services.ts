import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listServicesTool = defineTool({
  name: "list_services",
  title: "List services",
  description: "List services (categories/folders) for a team.",
  inputSchema: { team_id: z.string().uuid(), parent_id: z.string().uuid().nullable().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ team_id, parent_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("services").select("*").eq("team_id", team_id).order("name");
    if (parent_id !== undefined) q = parent_id === null ? q.is("parent_id", null) : q.eq("parent_id", parent_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ services: data ?? [] });
  },
});

export const getServiceTool = defineTool({
  name: "get_service",
  title: "Get service",
  description: "Get service.",
  inputSchema: { service_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ service_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("services").select("*").eq("id", service_id).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ service: data });
  },
});

export const createServiceTool = defineTool({
  name: "create_service",
  title: "Create service",
  description: "Create a service (or folder if parent_id is null and no category).",
  inputSchema: {
    team_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    category: z.string().max(120).optional(),
    parent_id: z.string().uuid().nullable().optional(),
    color: z.string().optional(),
    description: z.string().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("services").insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ service: data });
  },
});

export const updateServiceTool = defineTool({
  name: "update_service",
  title: "Update service",
  description: "Update service.",
  inputSchema: {
    service_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().max(120).optional(),
    color: z.string().optional(),
    description: z.string().optional(),
    parent_id: z.string().uuid().nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ service_id, ...patch }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return ok({ updated: false });
    const { data, error } = await sb(ctx).from("services").update(clean).eq("id", service_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ service: data });
  },
});

export const deleteServiceTool = defineTool({
  name: "delete_service",
  title: "Delete service",
  description: "Delete service.",
  inputSchema: { service_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ service_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("services").delete().eq("id", service_id);
    if (error) return fromPgError(error);
    return ok({ deleted: service_id });
  },
});
