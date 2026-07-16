import { defineTool } from "@lovable.dev/mcp-js";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const whoamiTool = defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in SoMA user's profile (id, name, email, avatar).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("profiles")
      .select("id, full_name, email, avatar_url, job_title")
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return fromPgError(error);
    return ok({ profile: data ?? { id: ctx.getUserId(), email: ctx.getUserEmail() } });
  },
});
