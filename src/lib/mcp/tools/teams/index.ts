import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";
import { zUuid } from "../../_shared/zod-common";

export const listMyTeamsTool = defineTool({
  name: "list_my_teams",
  title: "List my teams",
  description: "List the teams the signed-in user belongs to, with role. Start here.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("team_members")
      .select("role, team_id, joined_at, teams(id, name, description, created_at, access_code)")
      .eq("user_id", ctx.getUserId());
    if (error) return fromPgError(error);
    return okList("teams", data ?? []);
  },
});

export const getTeamTool = defineTool({
  name: "get_team",
  title: "Get team",
  description: "Fetch a team by id.",
  inputSchema: { team_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("teams").select("*").eq("id", team_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Team not found");
    return ok({ team: data }, { open_url: urls.team(team_id) });
  },
});

export const listTeamMembersTool = defineTool({
  name: "list_team_members",
  title: "List team members",
  description: "List members of a team with profile and role.",
  inputSchema: { team_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("team_members")
      .select("user_id, role, joined_at, profiles(id, full_name, avatar_url, email, job_title)")
      .eq("team_id", team_id);
    if (error) return fromPgError(error);
    return okList("members", data ?? []);
  },
});

export const listTeamPositionsTool = defineTool({
  name: "list_team_positions",
  title: "List team positions",
  description: "List the job positions defined for a team.",
  inputSchema: { team_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("team_positions").select("*").eq("team_id", team_id);
    if (error) return fromPgError(error);
    return okList("positions", data ?? []);
  },
});

export const joinTeamWithCodeTool = defineTool({
  name: "join_team_with_code",
  title: "Join team with access code",
  description: "Join a team using its 20-char access code. User becomes a 'member'.",
  inputSchema: { access_code: z.string().min(6).max(40) },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ access_code }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).rpc("join_team_with_code", { p_access_code: access_code });
    if (error) return fromPgError(error);
    return ok({ success: true, result: data });
  },
});

export const getPlanLimitsTool = defineTool({
  name: "get_plan_limits",
  title: "Get plan limits",
  description: "Fetch the current plan limits for a team (max boards, demands, members, services, notes).",
  inputSchema: { team_id: zUuid },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data: sub, error } = await sb(ctx).from("subscriptions")
      .select("plan_id, status, plans(id, name, max_boards, max_demands_per_month, max_team_members, max_services, max_notes)")
      .eq("team_id", team_id).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ subscription: sub });
  },
});
