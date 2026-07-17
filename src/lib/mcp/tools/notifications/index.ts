import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb } from "../../_shared/supabase";
import { ok, okList, okUpdated, fromPgError, requireAuth } from "../../_shared/envelope";
import { zUuid } from "../../_shared/zod-common";

export const listNotificationsTool = defineTool({
  name: "list_notifications",
  title: "List my notifications",
  description: "List the signed-in user's notifications (optionally only unread).",
  inputSchema: {
    only_unread: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_unread, limit }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    let q = sb(ctx).from("notifications").select("*").eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false }).limit(limit ?? 50);
    if (only_unread) q = q.eq("read", false);
    const { data, error } = await q;
    if (error) return fromPgError(error);
    return okList("notifications", data ?? []);
  },
});

export const markNotificationReadTool = defineTool({
  name: "mark_notification_read",
  title: "Mark notification as read",
  description: "Mark a single notification as read.",
  inputSchema: { notification_id: zUuid },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ notification_id }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("notifications").update({ read: true })
      .eq("id", notification_id).eq("user_id", ctx.getUserId()).select().maybeSingle();
    if (error) return fromPgError(error);
    return okUpdated({ notification: data });
  },
});

export const markAllReadTool = defineTool({
  name: "mark_all_read",
  title: "Mark all notifications as read",
  description: "Mark every unread notification for the user as read.",
  inputSchema: {},
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { error, count } = await sb(ctx).from("notifications").update({ read: true }, { count: "exact" })
      .eq("user_id", ctx.getUserId()).eq("read", false);
    if (error) return fromPgError(error);
    return ok({ success: true, updated: count ?? 0 });
  },
});

export const getNotificationPreferencesTool = defineTool({
  name: "get_notification_preferences",
  title: "Get notification preferences",
  description: "Fetch the user's notification preferences (channels, deadlines, approvals).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const { data, error } = await sb(ctx).from("user_preferences")
      .select("preference_key, preference_value").eq("user_id", ctx.getUserId())
      .in("preference_key", ["notifications", "deadline_reminders", "email_notifications", "push_notifications"]);
    if (error) return fromPgError(error);
    const prefs: Record<string, unknown> = {};
    for (const row of data ?? []) prefs[row.preference_key] = row.preference_value;
    return ok({ preferences: prefs });
  },
});

export const updateNotificationPreferencesTool = defineTool({
  name: "update_notification_preferences",
  title: "Update notification preferences",
  description: "Update one or more notification preference keys.",
  inputSchema: {
    preferences: z.record(z.string().max(80), z.any()).describe("Map of preference_key -> value. Keys: notifications, deadline_reminders, email_notifications, push_notifications."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ preferences }, ctx) => {
    const a = requireAuth(ctx); if (a) return a;
    const client = sb(ctx);
    const rows = Object.entries(preferences).map(([k, v]) => ({
      user_id: ctx.getUserId(), preference_key: k, preference_value: v as any,
    }));
    const { data, error } = await client.from("user_preferences").upsert(rows, { onConflict: "user_id,preference_key" }).select();
    if (error) return fromPgError(error);
    return ok({ success: true, updated: data ?? [] });
  },
});
