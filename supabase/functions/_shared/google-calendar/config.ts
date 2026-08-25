// Shared configuration + rollout gating helpers for the Google Calendar OAuth flow.
// The backend is the single authority for who may connect — the UI is only a hint.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Calendar scopes homologated in Phase 4 (events owned by SoMA + minimal OIDC identity). */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.owned",
];
export const GOOGLE_CALENDAR_SCOPE = GOOGLE_CALENDAR_SCOPES.join(" ");

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** OAuth state time-to-live: 10 minutes. */
export const STATE_TTL_MS = 10 * 60 * 1000;

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
