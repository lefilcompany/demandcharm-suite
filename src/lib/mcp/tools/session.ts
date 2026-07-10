import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
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
      .select("id, full_name, email, avatar_url, job_title, bio").eq("id", ctx.getUserId()).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ profile: data ?? { id: ctx.getUserId(), email: ctx.getUserEmail() } });
  },
});

export const getUserProfileTool = defineTool({
  name: "get_user_profile",
  title: "Get user profile",
  description: "Fetch a specific user's public profile by id. Respects RLS.",
  inputSchema: { user_id: z.string().uuid().describe("UUID of the user.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ user_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("profiles")
      .select("id, full_name, avatar_url, job_title, bio").eq("id", user_id).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ profile: data });
  },
});

export const updateMyProfileTool = defineTool({
  name: "update_my_profile",
  title: "Update my profile",
  description: "Update the signed-in user's profile (full_name, job_title, bio, avatar_url).",
  inputSchema: {
    full_name: z.string().trim().min(1).max(120).optional(),
    job_title: z.string().trim().max(120).optional(),
    bio: z.string().max(2000).optional(),
    avatar_url: z.string().url().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return ok({ updated: false }, "Nada para atualizar");
    const { data, error } = await sb(ctx).from("profiles").update(patch).eq("id", ctx.getUserId()).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ profile: data });
  },
});
