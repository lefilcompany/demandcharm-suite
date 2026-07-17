import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okCreated, okUpdated, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid } from "../../_shared/zod-common";

export const listProjectsTool = defineTool({
  name: "list_projects",
  title: "List projects (folders)",
  description: "List projects (SoMA+ folders) in a team.",
  inputSchema: { team_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("projects").select("*").eq("team_id", team_id).order("name");
    if (error) return fromPgError(error);
    return okList("projects", data ?? []);
  },
});

export const getProjectTool = defineTool({
  name: "get_project",
  title: "Get project",
  description: "Fetch a project (folder) by id.",
  inputSchema: { project_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("projects").select("*").eq("id", project_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Project not found");
    return ok({ project: data }, { open_url: urls.project(project_id) });
  },
});

export const createProjectTool = defineTool({
  name: "create_project",
  title: "Create project",
  description: "Create a new project/folder in a team.",
  inputSchema: {
    team_id: zUuid,
    name: z.string().min(1).max(200),
    color: z.string().max(20).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("projects")
      .insert({ ...input, created_by: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ project: data });
  },
});

export const linkDemandToProjectTool = defineTool({
  name: "link_demand_to_project",
  title: "Link demand to project",
  description: "Add a demand to a project (folder).",
  inputSchema: { project_id: zUuid, demand_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, demand_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("project_demands")
      .upsert({ project_id, demand_id }, { onConflict: "project_id,demand_id" })
      .select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ link: data });
  },
});
