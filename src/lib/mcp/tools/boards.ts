import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listBoardsTool = defineTool({
  name: "list_boards",
  title: "List boards",
  description: "List boards for a team (respects RLS — only boards the user can access).",
  inputSchema: { team_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ team_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("boards")
      .select("id, name, description, team_id, archived_at, created_at")
      .eq("team_id", team_id)
      .is("archived_at", null)
      .order("created_at");
    if (error) return fromPgError(error);
    return ok({ boards: data ?? [] });
  },
});
