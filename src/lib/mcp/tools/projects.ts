import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listProjectsTool = defineTool({
  name: "list_projects",
  title: "List projects (folders)",
  description: "List demand folders/projects the caller can access.",
  inputSchema: { team_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ team_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("projects").select("*").order("created_at", { ascending: false });
    if (team_id) q = q.eq("team_id", team_id);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ projects: data ?? [] });
  },
});

export const getProjectTool = defineTool({
  name: "get_project",
  title: "Get project",
  description: "Get project.",
  inputSchema: { project_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ project_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const c = sb(ctx);
    const { data: project, error } = await c.from("projects").select("*").eq("id", project_id).maybeSingle();
    if (error) return fromPgError(error);
    const { data: demands } = await c.from("project_demands").select("demand_id, demands(id, title, status_id, board_id)").eq("project_id", project_id);
    const { data: shares } = await c.from("project_shares").select("user_id, permission").eq("project_id", project_id);
    return ok({ project, demands: demands ?? [], shares: shares ?? [] });
  },
});

export const createProjectTool = defineTool({
  name: "create_project",
  title: "Create project",
  description: "Create project.",
  inputSchema: {
    team_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().optional(),
    color: z.string().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("projects").insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ project: data });
  },
});

export const updateProjectTool = defineTool({
  name: "update_project",
  title: "Update project",
  description: "Update project.",
  inputSchema: {
    project_id: z.string().uuid(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().optional(),
    color: z.string().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ project_id, ...patch }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return ok({ updated: false });
    const { data, error } = await sb(ctx).from("projects").update(clean).eq("id", project_id).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ project: data });
  },
});

export const deleteProjectTool = defineTool({
  name: "delete_project",
  title: "Delete project",
  description: "Delete project.",
  inputSchema: { project_id: z.string().uuid(), confirm: z.literal(true) },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ project_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("projects").delete().eq("id", project_id);
    if (error) return fromPgError(error);
    return ok({ deleted: project_id });
  },
});

export const addDemandToProjectTool = defineTool({
  name: "add_demand_to_project",
  title: "Add demand to project",
  description: "Add demand to project.",
  inputSchema: { project_id: z.string().uuid(), demand_id: z.string().uuid() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ project_id, demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("project_demands")
      .upsert({ project_id, demand_id }, { onConflict: "project_id,demand_id" }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ link: data });
  },
});

export const removeDemandFromProjectTool = defineTool({
  name: "remove_demand_from_project",
  title: "Remove demand from project",
  description: "Remove demand from project.",
  inputSchema: { project_id: z.string().uuid(), demand_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ project_id, demand_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("project_demands").delete().eq("project_id", project_id).eq("demand_id", demand_id);
    if (error) return fromPgError(error);
    return ok({ removed: demand_id });
  },
});
