import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("PUBLIC_APP_URL") || "https://pla.soma.lefil.com.br").replace(/\/$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "email" | "inapp";
type JsonRecord = Record<string, unknown>;

interface PublishRequest {
  action?: "publish" | "list";
  title?: string;
  message?: string;
  actionPath?: string;
}

interface DeliveryResult {
  status: "sent" | "skipped" | "failed";
  userId: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function boundedText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  const text = value.trim();
  if (text.length > max) throw new Error(`${field} too long`);
  return text;
}

function validateActionPath(value: unknown): string {
  if (value === undefined || value === null || value === "") return "/";
  if (typeof value !== "string") throw new Error("actionPath must be a string");
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 500) {
    throw new Error("actionPath must be a relative app path starting with /");
  }
  return path;
}

function channelEnabled(rawPreferences: unknown, channel: Channel): boolean {
  const prefs = asRecord(rawPreferences);
  if (!prefs) return true;

  // Current notification preference format.
  const channels = asRecord(prefs.channels);
  if (channels) {
    const channelPrefs = asRecord(channels[channel]);
    if (channelPrefs?.enabled === false) return false;
    const types = asRecord(channelPrefs?.types);
    if (types?.platformUpdates === false) return false;
    return true;
  }

  // Backward compatibility with legacy preferences.
  if (channel === "email" && prefs.emailNotifications === false) return false;
  return true;
}

async function getAllUsers(admin: ReturnType<typeof createClient>) {
  const users: Array<{ id: string; email?: string; user_metadata?: JsonRecord }> = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    for (const user of batch) {
      if (user.email) {
        users.push({
          id: user.id,
          email: user.email,
          user_metadata: asRecord(user.user_metadata) ?? undefined,
        });
      }
    }
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function getPreferenceMap(admin: ReturnType<typeof createClient>) {
  const map = new Map<string, unknown>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("user_preferences")
      .select("user_id, preference_value")
      .eq("preference_key", "notification_preferences")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) map.set(row.user_id, row.preference_value);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return map;
}

async function insertInAppNotifications(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
  title: string,
  message: string,
  actionPath: string,
) {
  const chunkSize = 500;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const rows = userIds.slice(i, i + chunkSize).map((userId) => ({
      user_id: userId,
      title: `Novidade: ${title}`,
      message,
      type: "success",
      read: false,
      link: actionPath,
    }));

    const { error } = await admin.from("notifications").insert(rows);
    if (error) throw error;
  }
}

async function sendReleaseEmail(
  user: { id: string; user_metadata?: JsonRecord },
  title: string,
  message: string,
  actionPath: string,
): Promise<DeliveryResult> {
  try {
    const actionUrl = `${APP_URL}${actionPath}`;
    const userName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : undefined;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        to: user.id,
        subject: `Novidade no SoMA+: ${title}`,
        template: "notification",
        templateData: {
          title: `Tem novidade no SoMA+ ✨`,
          message: `${title}\n\n${message}`,
          actionUrl,
          actionText: "Conhecer novidade",
          userName,
          type: "success",
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Feature release email failed", user.id, response.status, result);
      return { status: "failed", userId: user.id };
    }
    if (result?.skipped) return { status: "skipped", userId: user.id };
    return { status: "sent", userId: user.id };
  } catch (error) {
    console.error("Feature release email error", user.id, error);
    return { status: "failed", userId: user.id };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Server configuration error" }, 500);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const payload = (await req.json().catch(() => ({}))) as PublishRequest;
    const action = payload.action ?? "publish";

    if (action === "list") {
      const { data, error } = await admin
        .from("feature_releases")
        .select("id, title, message, action_path, published_at, inapp_recipient_count, email_recipient_count, email_success_count, email_skipped_count, email_failure_count")
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return json({ releases: data ?? [] });
    }

    const title = boundedText(payload.title, "title", 200);
    const message = boundedText(payload.message, "message", 5000);
    const actionPath = validateActionPath(payload.actionPath);

    const [users, preferenceMap] = await Promise.all([
      getAllUsers(admin),
      getPreferenceMap(admin),
    ]);

    const inappUsers = users.filter((user) =>
      channelEnabled(preferenceMap.get(user.id), "inapp")
    );
    const emailUsers = users.filter((user) =>
      channelEnabled(preferenceMap.get(user.id), "email")
    );

    const { data: release, error: releaseError } = await admin
      .from("feature_releases")
      .insert({
        title,
        message,
        action_path: actionPath,
        published_by: authData.user.id,
        inapp_recipient_count: inappUsers.length,
        email_recipient_count: emailUsers.length,
      })
      .select("id, published_at")
      .single();
    if (releaseError) throw releaseError;

    await insertInAppNotifications(
      admin,
      inappUsers.map((user) => user.id),
      title,
      message,
      actionPath,
    );

    const emailResults = await mapWithConcurrency(
      emailUsers,
      8,
      (user) => sendReleaseEmail(user, title, message, actionPath),
    );

    const emailSuccessCount = emailResults.filter((r) => r.status === "sent").length;
    const emailSkippedCount = emailResults.filter((r) => r.status === "skipped").length;
    const emailFailureCount = emailResults.filter((r) => r.status === "failed").length;

    const { error: updateError } = await admin
      .from("feature_releases")
      .update({
        email_success_count: emailSuccessCount,
        email_skipped_count: emailSkippedCount,
        email_failure_count: emailFailureCount,
      })
      .eq("id", release.id);
    if (updateError) console.error("Could not update release delivery counters", updateError);

    return json({
      success: true,
      release: {
        id: release.id,
        published_at: release.published_at,
        inapp_recipient_count: inappUsers.length,
        email_recipient_count: emailUsers.length,
        email_success_count: emailSuccessCount,
        email_skipped_count: emailSkippedCount,
        email_failure_count: emailFailureCount,
      },
    });
  } catch (error) {
    console.error("publish-feature-release error", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
    );
  }
});
