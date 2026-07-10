import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

const channel = z.enum(["general", "internal"]);

export const listDemandCommentsTool = defineTool({
  name: "list_demand_comments",
  title: "List demand comments",
  description: "List chat/comment messages on a demand. Channel 'general' is visible to everyone with access; 'internal' is limited to admin/moderator/executor.",
  inputSchema: {
    demand_id: z.string().uuid(),
    channel: channel.default("general"),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ demand_id, channel: ch, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_interactions")
      .select("id, user_id, channel, content, created_at, profiles(id, full_name, avatar_url)")
      .eq("demand_id", demand_id).eq("channel", ch).order("created_at", { ascending: false }).limit(limit);
    if (error) return fromPgError(error);
    return ok({ comments: data ?? [] });
  },
});

export const postDemandCommentTool = defineTool({
  name: "post_demand_comment",
  title: "Post demand comment",
  description: "Post a message on a demand. Use [[uuid:Name]] to mention a user (they receive an in-app notification).",
  inputSchema: {
    demand_id: z.string().uuid(),
    content: z.string().trim().min(1).max(10000),
    channel: channel.default("general"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false },
  handler: async ({ demand_id, content, channel: ch }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("demand_interactions")
      .insert({ demand_id, content, channel: ch, user_id: ctx.getUserId() }).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ comment: data });
  },
});

export const deleteDemandCommentTool = defineTool({
  name: "delete_demand_comment",
  title: "Delete demand comment",
  description: "Delete demand comment.",
  inputSchema: { comment_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ comment_id }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error } = await sb(ctx).from("demand_interactions").delete().eq("id", comment_id);
    if (error) return fromPgError(error);
    return ok({ deleted: comment_id });
  },
});
