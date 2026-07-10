import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, requireAuth, ok, fromPgError } from "../_shared/supabase";

export const listNotificationsTool = defineTool({
  name: "list_notifications",
  title: "List notifications",
  description: "List the caller's in-app notifications.",
  inputSchema: {
    unread_only: z.boolean().default(false),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async ({ unread_only, limit }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    let q = sb(ctx).from("notifications").select("*").eq("user_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(limit);
    if (unread_only) q = q.eq("read", false);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return ok({ notifications: data ?? [] });
  },
});

export const markNotificationReadTool = defineTool({
  name: "mark_notification_read",
  title: "Mark notification read",
  description: "Mark notification read.",
  inputSchema: { notification_id: z.string().uuid(), read: z.boolean().default(true) },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async ({ notification_id, read }, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { data, error } = await sb(ctx).from("notifications").update({ read }).eq("id", notification_id).eq("user_id", ctx.getUserId()).select().maybeSingle();
    if (error) return fromPgError(error);
    return ok({ notification: data });
  },
});

export const markAllNotificationsReadTool = defineTool({
  name: "mark_all_notifications_read",
  title: "Mark all notifications read",
  description: "Mark all notifications read.",
  inputSchema: {},
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async (_i, ctx) => {
    const auth = requireAuth(ctx); if (auth) return auth;
    const { error, count } = await sb(ctx).from("notifications").update({ read: true }, { count: "exact" }).eq("user_id", ctx.getUserId()).eq("read", false);
    if (error) return fromPgError(error);
    return ok({ updated: count ?? 0 });
  },
});
