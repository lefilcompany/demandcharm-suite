import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
}

interface UserPreferences {
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  demandUpdates?: boolean;
  teamUpdates?: boolean;
  deadlineReminders?: boolean;
  adjustmentRequests?: boolean;
  mentionNotifications?: boolean;
}

// Map internal notification channel -> email visual type
function emailTypeForNotification(notificationType: string): "info" | "success" | "warning" | "error" {
  switch (notificationType) {
    case "adjustmentRequests":
      return "warning";
    case "deadlineReminders":
      return "warning";
    case "mentionNotifications":
      return "info";
    case "teamUpdates":
      return "info";
    default:
      return "info";
  }
}


interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface FcmErrorDetail {
  "@type"?: string;
  errorCode?: string;
  fieldViolations?: { field?: string; description?: string }[];
}

interface FcmErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: FcmErrorDetail[];
  };
}

// ---------- Pure helpers (exported for tests) ----------

/**
 * Resolve a link against APP_URL. Accepts only https (or http on localhost)
 * and only the same origin as APP_URL. Anything else falls back to `${APP_URL}/`.
 */
export function normalizeLink(link: string | undefined | null, appUrl: string): string {
  let base: URL;
  try {
    base = new URL(appUrl);
  } catch {
    // If APP_URL is invalid, we cannot safely resolve — but we prefer to still
    // return something benign; caller should have validated APP_URL first.
    return appUrl;
  }
  const fallback = `${base.origin}/`;
  const raw = link && link.length > 0 ? link : "/";
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return fallback;
    if (resolved.protocol === "http:" && resolved.hostname !== "localhost" && resolved.hostname !== "127.0.0.1") {
      return fallback;
    }
    if (resolved.origin !== base.origin) return fallback;
    return resolved.toString();
  } catch {
    return fallback;
  }
}

/**
 * Classify an FCM HTTP v1 error response. Only returns removeToken=true when the
 * server explicitly says the registration token is unregistered or the token
 * field itself is invalid.
 */
export function classifyFcmError(
  parsed: FcmErrorResponse | null,
  rawStatus: number,
): { code: string; removeToken: boolean } {
  const details = parsed?.error?.details ?? [];
  for (const d of details) {
    if (d.errorCode === "UNREGISTERED") {
      return { code: "UNREGISTERED", removeToken: true };
    }
    if (d.errorCode === "INVALID_ARGUMENT") {
      const violations = d.fieldViolations ?? [];
      const tokenViolation = violations.find(
        (v) => (v.field ?? "").toLowerCase().includes("token"),
      );
      if (tokenViolation) {
        return { code: "INVALID_TOKEN", removeToken: true };
      }
      return { code: "INVALID_ARGUMENT", removeToken: false };
    }
    if (d.errorCode === "SENDER_ID_MISMATCH") {
      return { code: "SENDER_ID_MISMATCH", removeToken: false };
    }
  }
  const status = parsed?.error?.status ?? `HTTP_${rawStatus}`;
  return { code: status, removeToken: false };
}

// ---------- Google OAuth token minting ----------

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };
  const b64url = (s: string) =>
    btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;

  const pem = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${signingInput}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) {
    // Avoid leaking the JWT or the raw Google response.
    throw new Error(`google_oauth_failed_${resp.status}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function sendOne(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  link: string,
  data: Record<string, string>,
  notificationType: string,
): Promise<{ ok: boolean; code?: string; removeToken?: boolean }> {
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      webpush: {
        notification: {
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: notificationType || "soma-notification",
        },
        fcm_options: { link },
      },
      data,
    },
  };
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      },
    );
    if (resp.ok) {
      // Consume body
      await resp.json().catch(() => undefined);
      return { ok: true };
    }
    let parsed: FcmErrorResponse | null = null;
    try {
      parsed = await resp.json();
    } catch {
      parsed = null;
    }
    const { code, removeToken } = classifyFcmError(parsed, resp.status);
    console.warn("[push] FCM error", { code, status: resp.status });
    return { ok: false, code, removeToken };
  } catch (err) {
    console.error("[push] FCM fetch failed", (err as Error)?.message);
    return { ok: false, code: "NETWORK_ERROR", removeToken: false };
  }
}

function shouldSendNotification(
  preferences: UserPreferences | null,
  notificationType: string,
): boolean {
  if (!preferences) return true;
  if (preferences.pushNotifications === false) return false;
  switch (notificationType) {
    case "demandUpdates":
      return preferences.demandUpdates !== false;
    case "teamUpdates":
      return preferences.teamUpdates !== false;
    case "deadlineReminders":
      return preferences.deadlineReminders !== false;
    case "adjustmentRequests":
      return preferences.adjustmentRequests !== false;
    case "mentionNotifications":
      return preferences.mentionNotifications !== false;
    default:
      return true;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // 1. Authenticate
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const cronToken = Deno.env.get("CRON_TOKEN");
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isCronCall =
      !!bearer && ((!!cronSecret && bearer === cronSecret) || (!!cronToken && bearer === cronToken));

    let callerUserId: string | null = null;
    if (!isCronCall) {
      if (!authHeader.startsWith("Bearer ")) return respond(401, { error: "Unauthorized" });
      const token = authHeader.slice(7);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) return respond(401, { error: "Unauthorized" });
      callerUserId = userData.user.id;
    }

    // 2. Validate request
    const { userId, userIds, title, body, link, data }: PushNotificationRequest = await req.json();
    if (!title || !body) return respond(400, { error: "title and body are required" });
    const notificationType = data?.notificationType || "demandUpdates";

    const targetUserIds: string[] = [];
    if (userId) targetUserIds.push(userId);
    if (userIds) targetUserIds.push(...userIds);
    const uniqueUserIds = [...new Set(targetUserIds)];
    if (uniqueUserIds.length === 0) return respond(400, { error: "userId or userIds is required" });

    // 3. Authorized users
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let allowedUserIds = uniqueUserIds;
    let blocked = 0;
    if (!isCronCall && callerUserId) {
      const { data: callerTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", callerUserId);
      const callerTeamIds = (callerTeams || []).map((r: { team_id: string }) => r.team_id);
      if (callerTeamIds.length === 0) {
        allowedUserIds = uniqueUserIds.filter((id) => id === callerUserId);
      } else {
        const { data: shared } = await supabase
          .from("team_members")
          .select("user_id")
          .in("team_id", callerTeamIds)
          .in("user_id", allowedUserIds);
        const set = new Set((shared || []).map((r: { user_id: string }) => r.user_id));
        set.add(callerUserId);
        allowedUserIds = uniqueUserIds.filter((id) => set.has(id));
      }
      blocked = uniqueUserIds.length - allowedUserIds.length;
    }

    if (allowedUserIds.length === 0) {
      return respond(200, { success: true, sent: 0, failed: 0, skipped: 0, blocked, errors: [] });
    }

    // 4. Preferences
    const { data: notifPreferences } = await supabase
      .from("user_preferences")
      .select("user_id, preference_value")
      .eq("preference_key", "notification_preferences")
      .in("user_id", allowedUserIds);
    const userPrefsMap = new Map<string, UserPreferences>();
    for (const p of notifPreferences || []) {
      userPrefsMap.set(p.user_id, p.preference_value as UserPreferences);
    }

    // 5. Tokens (per-device)
    const { data: tokens, error: tokensError } = await supabase
      .from("fcm_tokens")
      .select("id, user_id, token, device_id")
      .in("user_id", allowedUserIds);
    if (tokensError) {
      console.error("[push] fetching tokens failed", tokensError.message);
      return respond(500, { error: "database_error" });
    }

    // 6. Filter opted-out users
    const eligible = (tokens || []).filter((row) => {
      const prefs = userPrefsMap.get(row.user_id) || null;
      return shouldSendNotification(prefs, notificationType);
    });
    const skipped = (tokens?.length || 0) - eligible.length;

    if (eligible.length === 0) {
      return respond(200, {
        success: true,
        sent: 0,
        failed: 0,
        skipped,
        blocked,
        errors: [],
      });
    }

    // 7. Firebase config
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      console.error("[push] FIREBASE_SERVICE_ACCOUNT missing");
      return respond(500, { error: "firebase_not_configured" });
    }
    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
      return respond(500, { error: "firebase_service_account_invalid" });
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
      console.error("[push] service account missing required fields");
      return respond(500, { error: "firebase_service_account_incomplete" });
    }
    const configuredProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    if (!configuredProjectId) {
      console.error("[push] FIREBASE_PROJECT_ID missing");
      return respond(500, { error: "firebase_project_id_missing" });
    }
    if (serviceAccount.project_id !== configuredProjectId) {
      console.error("[push] service account project_id mismatch");
      return respond(500, { error: "firebase_project_id_mismatch" });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://demandcharm-suite.lovable.app";
    const finalLink = normalizeLink(link, appUrl);

    const notificationData: Record<string, string> = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        notificationData[k] = String(v);
      }
    }
    notificationData.link = finalLink;

    // 8. Access token (only after we know we have targets)
    let accessToken: string;
    try {
      accessToken = await getAccessToken(serviceAccount);
    } catch (err) {
      console.error("[push] access token failed", (err as Error)?.message);
      return respond(500, { error: "google_auth_failed" });
    }

    // 9. Send
    let sent = 0;
    let failed = 0;
    const errors: { userId: string; deviceId: string; code: string }[] = [];
    const tokensToRemove: string[] = [];

    for (const row of eligible) {
      const r = await sendOne(
        accessToken,
        serviceAccount.project_id,
        row.token,
        title,
        body,
        finalLink,
        notificationData,
        notificationType,
      );
      if (r.ok) {
        sent++;
      } else {
        failed++;
        errors.push({ userId: row.user_id, deviceId: row.device_id, code: r.code || "UNKNOWN" });
        if (r.removeToken) tokensToRemove.push(row.token);
      }
    }

    if (tokensToRemove.length > 0) {
      const { error: delErr } = await supabase
        .from("fcm_tokens")
        .delete()
        .in("token", tokensToRemove);
      if (delErr) console.error("[push] token cleanup failed", delErr.message);
    }

    return respond(200, {
      success: failed === 0,
      sent,
      failed,
      skipped,
      blocked,
      errors,
    });
  } catch (err) {
    console.error("[push] fatal", (err as Error)?.message);
    return respond(500, { error: "internal_error" });
  }
});
