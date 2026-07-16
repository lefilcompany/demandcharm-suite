import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listMyTeamsTool = defineTool({
  name: "list_my_teams",
  title: "List my teams",
  description: "List teams the signed-in user belongs to, with their role.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("team_members")
      .select("role, team_id, teams(id, name, description, created_at)")
      .eq("user_id", ctx.getUserId());
    if (error) return fromPgError(error);
    return ok({ teams: data ?? [] });
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
