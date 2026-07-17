import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { okList, okCreated, okDeleted, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid } from "../../_shared/zod-common";

export const listCommentsTool = defineTool({
  name: "list_comments",
  title: "List comments",
  description: "List comments/messages on a demand chat.",
  inputSchema: { demand_id: zUuid, limit: z.number().int().min(1).max(200).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ demand_id, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_interactions")
      .select("id, demand_id, user_id, content, interaction_type, channel, metadata, created_at, profiles(id, full_name, avatar_url)")
      .eq("demand_id", demand_id).order("created_at", { ascending: false }).limit(limit ?? 50);
    if (error) return fromPgError(error);
    return okList("comments", (data ?? []).reverse());
  },
});

export const postCommentTool = defineTool({
  name: "post_comment",
  title: "Post comment",
  description: "Publish a comment on a demand. Use `internal: true` for internal channel.",
  inputSchema: {
    demand_id: zUuid,
    content: z.string().min(1).max(10000),
    internal: z.boolean().optional().describe("If true, restricts to internal channel."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ demand_id, content, internal }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("demand_interactions").insert({
      demand_id, user_id: ctx.getUserId(), content,
      interaction_type: "comment",
      channel: internal ? "internal" : "public",
    }).select().maybeSingle();
    if (error) return fromPgError(error);
    return okCreated({ comment: data });
  },
});

export const deleteCommentTool = defineTool({
  name: "delete_comment",
  title: "Delete comment",
  description: "Delete a comment (only the author or an admin can).",
  inputSchema: { comment_id: zUuid },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ comment_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error } = await sb(ctx).from("demand_interactions").delete().eq("id", comment_id);
    if (error) return fromPgError(error);
    return okDeleted(comment_id);
  },
});
