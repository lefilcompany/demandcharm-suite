// Starts the Google Calendar OAuth 2.0 web-server flow for the signed-in SoMA user.
// Returns only the Google consent URL — no tokens, no secrets.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_CALENDAR_SCOPE,
  googleOAuthClient,
  isCalendarAvailableForUser,
  redirectUri,
  safeRedirectPath,
  STATE_TTL_MS,
  userClient,
} from "../_shared/google-calendar/config.ts";
import { randomStateValue, sha256Hex } from "../_shared/google-calendar/crypto.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userError } = await userClient(authHeader).auth.getUser();
    if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = adminClient();

    // Rollout gate — the backend, not the UI, decides who may connect.
    if (!(await isCalendarAvailableForUser(admin, userId))) {
      return json({ error: "google_calendar_unavailable" }, 403);
    }

    const client = googleOAuthClient();
    if (!client) return json({ error: "google_calendar_not_configured" }, 500);

    let requestedPath: string | null = null;
    try {
      const body = await req.json();
      requestedPath = typeof body?.redirect_path === "string" ? body.redirect_path : null;
    } catch { /* no body */ }
    const redirectPath = safeRedirectPath(requestedPath);

    // Cryptographically secure state (32 random bytes); only its SHA-256 is persisted.
    const state = randomStateValue();
    const stateHash = await sha256Hex(state);

    // Drop any pending unused state for this user, then store the new one.
    await admin.from("google_oauth_states").delete().eq("user_id", userId).is("used_at", null);

    const { error: insertError } = await admin.from("google_oauth_states").insert({
      user_id: userId,
      state_hash: stateHash,
      redirect_path: redirectPath,
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    });
    if (insertError) {
      console.error("failed to persist oauth state:", insertError.message);
      return json({ error: "state_persist_failed" }, 500);
    }

    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set("client_id", client.clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);

    return json({ url: url.toString() });
  } catch (e) {
    console.error("google-calendar-oauth-start failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "internal_error" }, 500);
  }
});
