import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError, err } from "../_shared/supabase";

export const listMyTeamsTool = defineTool({
  name: "list_my_teams",
  title: "List my teams",
  description: "List teams the signed-in user belongs to, with their role.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("team_members")
      .select("role, team_id, teams(id, name, description, access_code, created_at)")
      .eq("user_id", ctx.getUserId());
    if (error) return fromPgError(error);
    return ok({ teams: data ?? [] });
  },
});

export const getTeamTool = defineTool({
  name: "get_team",
  title: "Get team",
  description: "Fetch a team's details including the active plan.",
  inputSchema: { team_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const client = sb(ctx);
    const { data: team, error } = await client.from("teams").select("*").eq("id", team_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!team) return err("Team not found", "NOT_FOUND");
    const { data: plan } = await client.rpc("get_team_active_plan", { _team_id: team_id });
    return ok({ team, plan });
  },
});

export const listTeamMembersTool = defineTool({
  name: "list_team_members",
  title: "List team members",
  description: "List members of a team with profile and role.",
  inputSchema: { team_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("team_members")
      .select("user_id, role, joined_at, profiles(id, full_name, avatar_url, email, job_title)")
      .eq("team_id", team_id);
    if (error) return fromPgError(error);
    return ok({ members: data ?? [] });
  },
});

export const listTeamPositionsTool = defineTool({
  name: "list_team_positions",
  title: "List team positions",
  description: "List job positions (cargos) configured for a team.",
  inputSchema: { team_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("team_positions").select("*").eq("team_id", team_id).order("name");
    if (error) return fromPgError(error);
    return ok({ positions: data ?? [] });
  },
});

export const joinTeamWithCodeTool = defineTool({
  name: "join_team_with_code",
  title: "Join team with access code",
  description: "Join a team using its 20-character access code. The caller is added as a 'requester' (member).",
  inputSchema: { code: z.string().trim().min(4).max(40) },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ code }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).rpc("join_team_with_code", { p_code: code });
    if (error) return fromPgError(error);
    return ok({ team_id: data });
  },
});

export const getPlanLimitsTool = defineTool({
  name: "get_plan_limits",
  title: "Get plan limits and usage",
  description: "Return current usage vs plan limits for a team (boards, members, demands, services, notes).",
  inputSchema: { team_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const client = sb(ctx);
    const resources = ["boards", "members", "demands", "services", "notes"] as const;
    const results: Record<string, unknown> = {};
    for (const r of resources) {
      const { data, error } = await client.rpc("check_plan_limit", { _team_id: team_id, _resource: r });
      if (error) return fromPgError(error);
      results[r] = data;
    }
    return ok({ limits: results });
  },
});
