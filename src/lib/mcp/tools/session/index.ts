import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, err, fromPgError, requireAuth } from "../../_shared/envelope";
import { urls } from "../../_shared/urls";

export const whoamiTool = defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in SoMA+ user's profile (id, name, email, avatar, job title).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("profiles")
      .select("id, full_name, email, avatar_url, job_title, created_at")
      .eq("id", ctx.getUserId()).maybeSingle();
    if (error) return fromPgError(error);
    return ok({ profile: data ?? { id: ctx.getUserId(), email: ctx.getUserEmail() } }, { open_url: urls.profile(ctx.getUserId()!) });
  },
});

export const getProfileTool = defineTool({
  name: "get_profile",
  title: "Get profile",
  description: "Fetch any user's public profile (respects RLS).",
  inputSchema: { user_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ user_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .eq("id", user_id).maybeSingle();
    if (error) return fromPgError(error);
    if (!data) return err("NOT_FOUND", "Profile not found");
    return ok({ profile: data }, { open_url: urls.profile(user_id) });
  },
});

export const updateProfileTool = defineTool({
  name: "update_profile",
  title: "Update my profile",
  description: "Update the signed-in user's own profile fields.",
  inputSchema: {
    full_name: z.string().trim().min(1).max(200).optional(),
    job_title: z.string().max(200).optional(),
    avatar_url: z.string().url().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const patch: Record<string, unknown> = { ...input };
    Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
    if (Object.keys(patch).length === 0) return err("VALIDATION", "No fields to update");
    const { data, error } = await sb(ctx).from("profiles").update(patch).eq("id", ctx.getUserId()).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ success: true, profile: data });
  },
});
