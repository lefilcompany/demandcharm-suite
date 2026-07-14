import React from "npm:react@18.3.1";
import { render } from "npm:@react-email/render@0.0.12";
import { createClient } from "npm:@supabase/supabase-js@2";
import { NotificationEmail } from "../send-email/_templates/notification.tsx";
import { runDeadlineReminderJob } from "./job.ts";
import {
  DEFAULT_APP_URL,
  DEFAULT_NOTIFICATION_TIME_ZONE,
  isDeadlineCronAuthorized,
  type DeadlineReminder,
  type DeliveryStatus,
  type NotificationPreferences,
  type UserProfile,
} from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_FROM = "SoMA+ <noreply@pla.soma.lefil.com.br>";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function sendResendEmail({
  apiKey,
  to,
  subject,
  html,
  maxRetries = 3,
}: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  maxRetries?: number;
}): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    const payload = await parseJsonResponse(response);
    if (response.ok) return;

    if (response.status === 429 && attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }

    throw new Error(`Resend failed (${response.status}): ${JSON.stringify(payload).slice(0, 1000)}`);
  }
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authorized = await isDeadlineCronAuthorized(
      authHeader,
      cronSecret,
      async (token) => {
        const { data, error } = await supabase.rpc("verify_deadline_cron_secret", {
          p_secret: token,
        });
        if (error) {
          console.error(`[${requestId}] Failed to verify database cron secret`, error);
          return false;
        }
        return data === true;
      },
    );

    if (!authorized) {
      const clientIp = req.headers.get("x-forwarded-for") ||
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-real-ip") ||
        "unknown";
      console.warn(`[${requestId}] Unauthorized check-deadlines request from ${clientIp}`);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const timeZone = Deno.env.get("NOTIFICATION_TIME_ZONE") || DEFAULT_NOTIFICATION_TIME_ZONE;
    const appUrl = Deno.env.get("APP_URL") || DEFAULT_APP_URL;

    console.log(`[${requestId}] Starting deadline reminder job in ${timeZone}`);

    const result = await runDeadlineReminderJob(
      {
        listDemandsDueBetween: async (start, end) => {
          const { data, error } = await supabase
            .from("demands")
            .select(`
              id,
              title,
              due_date,
              assigned_to,
              delivered_at,
              demand_statuses!inner(name)
            `)
            .gte("due_date", start.toISOString())
            .lt("due_date", end.toISOString())
            .eq("archived", false)
            .is("delivered_at", null)
            .neq("demand_statuses.name", "Entregue");

          if (error) throw error;
          return (data || [])
            .filter((demand) => Boolean(demand.due_date))
            .map((demand) => ({
              id: demand.id,
              title: demand.title,
              due_date: demand.due_date as string,
              assigned_to: demand.assigned_to,
            }));
        },

        listOverdueDemands: async (before) => {
          const { data, error } = await supabase
            .from("demands")
            .select(`
              id,
              title,
              due_date,
              assigned_to,
              delivered_at,
              demand_statuses!inner(name)
            `)
            .lt("due_date", before.toISOString())
            .eq("archived", false)
            .is("delivered_at", null)
            .neq("demand_statuses.name", "Entregue");

          if (error) throw error;
          return (data || [])
            .filter((demand) => Boolean(demand.due_date))
            .map((demand) => ({
              id: demand.id,
              title: demand.title,
              due_date: demand.due_date as string,
              assigned_to: demand.assigned_to,
            }));
        },

        listAssignees: async (demandIds) => {
          if (demandIds.length === 0) return [];
          const { data, error } = await supabase
            .from("demand_assignees")
            .select("demand_id, user_id, is_primary")
            .in("demand_id", demandIds);
          if (error) throw error;
          return data || [];
        },

        listPreferences: async (userIds) => {
          const map = new Map<string, NotificationPreferences>();
          if (userIds.length === 0) return map;

          const { data, error } = await supabase
            .from("user_preferences")
            .select("user_id, preference_value")
            .eq("preference_key", "notification_preferences")
            .in("user_id", userIds);
          if (error) throw error;

          for (const row of data || []) {
            map.set(row.user_id, (row.preference_value || {}) as NotificationPreferences);
          }
          return map;
        },

        listProfiles: async (userIds) => {
          const map = new Map<string, UserProfile>();
          if (userIds.length === 0) return map;

          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);
          if (error) throw error;

          for (const profile of data || []) map.set(profile.id, profile);
          return map;
        },

        claimDelivery: async (eventKey, eventType, demandId, userId, channel) => {
          const { data, error } = await supabase.rpc("claim_notification_delivery", {
            p_event_key: eventKey,
            p_event_type: eventType,
            p_demand_id: demandId,
            p_user_id: userId,
            p_channel: channel,
          });
          if (error) throw error;
          return data === true;
        },

        markDelivery: async (eventKey, userId, channel, status, errorMessage) => {
          const update: {
            status: DeliveryStatus;
            last_error: string | null;
            delivered_at: string | null;
            updated_at: string;
          } = {
            status,
            last_error: errorMessage || null,
            delivered_at: status === "sent" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("notification_deliveries")
            .update(update)
            .eq("event_key", eventKey)
            .eq("user_id", userId)
            .eq("channel", channel);
          if (error) throw error;
        },

        createInAppNotification: async (reminder) => {
          const { error } = await supabase.from("notifications").insert({
            user_id: reminder.userId,
            title: reminder.title,
            message: reminder.message,
            type: reminder.severity,
            link: reminder.link,
          });
          if (error) throw error;
          return { status: "sent" };
        },

        sendEmail: async (reminder: DeadlineReminder, profile?: UserProfile) => {
          let email = profile?.email || null;
          if (!email) {
            const { data, error } = await supabase.auth.admin.getUserById(reminder.userId);
            if (error) throw error;
            email = data.user?.email || null;
          }

          if (!email) {
            return { status: "skipped", reason: "User has no email address" };
          }

          const html = await render(
            React.createElement(NotificationEmail, {
              title: reminder.title,
              message: reminder.message,
              actionUrl: reminder.actionUrl,
              actionText: "Ver demanda",
              userName: reminder.userName,
              type: reminder.severity,
            }),
          );

          if (!resendApiKey) {
            throw new Error("RESEND_API_KEY not configured");
          }

          await sendResendEmail({
            apiKey: resendApiKey,
            to: email,
            subject: reminder.emailSubject,
            html,
          });
          return { status: "sent" };
        },

        sendPush: async (reminder) => {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader || "",
            },
            body: JSON.stringify({
              userIds: [reminder.userId],
              title: reminder.title,
              body: reminder.message,
              link: reminder.actionUrl,
              data: {
                notificationType: "deadlineReminders",
                type: reminder.eventType,
                demandId: reminder.demandId,
                dueDate: reminder.dueDateKey,
              },
            }),
          });

          const payload = await parseJsonResponse(response);
          if (!response.ok) {
            throw new Error(
              `Push function failed (${response.status}): ${JSON.stringify(payload).slice(0, 1000)}`,
            );
          }

          const sent = Number(payload.sent || 0);
          const failed = Number(payload.failed || 0);
          const skipped = Number(payload.skipped || 0);
          if (failed > 0 && sent === 0) {
            throw new Error(`FCM failed for all tokens: ${JSON.stringify(payload).slice(0, 1000)}`);
          }
          if (sent > 0) return { status: "sent" };
          return {
            status: "skipped",
            reason: skipped > 0 ? "Disabled by push preferences" : "No active FCM token",
          };
        },
      },
      { timeZone, appUrl },
    );

    console.log(`[${requestId}] Deadline reminder job completed`, result);
    return jsonResponse({ message: "Deadline reminder job completed", ...result });
  } catch (error) {
    console.error(`[${requestId}] check-deadlines failed:`, error);
    return jsonResponse({ error: "Internal server error", requestId }, 500);
  }
}

Deno.serve(handler);
