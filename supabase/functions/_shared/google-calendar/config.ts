// Shared configuration + rollout gating helpers for the Google Calendar OAuth flow.
// The backend is the single authority for who may connect — the UI is only a hint.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Phase 4 scopes (events owned by SoMA + minimal OIDC identity) kept unchanged,
 * plus the Phase 4.3 Google Meet scopes:
 *  - meetings.space.created  -> create/configure Meet spaces owned by SoMA
 *  - meetings.space.readonly -> read conference records / future transcript artifacts
 * The Google login of SoMA is a separate flow and is NOT affected by this list.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
];
export const GOOGLE_CALENDAR_SCOPE = GOOGLE_CALENDAR_SCOPES.join(" ");

/** Scopes a connection MUST hold to be considered fully granted. */
export const REQUIRED_GRANTED_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
];

/** Google may downgrade `calendar.events` to `calendar.events.owned`; either is fine. */
export const CALENDAR_EVENTS_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

/** Google may return the email scope in either short or canonical form. */
function normalizeScope(scope: string): string {
  if (scope === "https://www.googleapis.com/auth/userinfo.email") return "email";
  if (scope === "https://www.googleapis.com/auth/userinfo.profile") return "profile";
  return scope;
}

export function hasAllRequiredScopes(granted: string[] | null | undefined): boolean {
  const set = new Set((granted ?? []).map(normalizeScope));
  if (!CALENDAR_EVENTS_SCOPES.some((s) => set.has(s))) return false;
  return REQUIRED_GRANTED_SCOPES.every((s) => set.has(s));
}

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** OAuth state time-to-live: 10 minutes. */
export const STATE_TTL_MS = 10 * 60 * 1000;

export function isGoogleCalendarEnabled(): boolean {
  const raw = (Deno.env.get("GOOGLE_CALENDAR_ENABLED") ?? "").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function isAutoAcceptEnabled(): boolean {
  const raw = (Deno.env.get("GOOGLE_CALENDAR_AUTO_ACCEPT_ENABLED") ?? "true").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const client = googleOAuthClient();
  if (!client) throw new Error("google_calendar_not_configured");
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw Object.assign(new Error(`token_refresh_failed [${response.status}]: ${details}`), { reauth: response.status === 400 || response.status === 401 });
  }
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("token_refresh_no_access_token");
  return data.access_token;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function userClient(authHeader: string): SupabaseClient {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  return createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

/** Callback registered in the Google Cloud OAuth client (PROD). */
export function redirectUri(): string {
  const override = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI");
  if (override) return override.trim();
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  return `${base}/functions/v1/google-calendar-oauth-callback`;
}

export function appUrl(): string {
  return (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
}

export function googleOAuthClient(): { clientId: string; clientSecret: string } | null {
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Rollout gate read from the database (`app_feature_flags.google_calendar_enabled`):
 * `off` blocks everyone, `internal` allows only allow-listed users, `all` allows anyone.
 */
export async function isCalendarAvailableForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: flag, error } = await admin
    .from("app_feature_flags")
    .select("rollout")
    .eq("key", "google_calendar_enabled")
    .maybeSingle();

  if (error || !flag) return false;
  const rollout = String((flag as { rollout: string }).rollout);
  if (rollout === "all") return true;
  if (rollout !== "internal") return false;

  const { data: allow } = await admin
    .from("google_calendar_rollout_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!allow;
}

/** Only same-app paths may be used as the post-consent destination (no open redirect). */
export function safeRedirectPath(candidate: string | null | undefined): string {
  const fallback = "/settings?tab=integrations";
  if (!candidate || typeof candidate !== "string") return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("://") || candidate.includes("\\")) return fallback;
  return candidate.slice(0, 300);
}
