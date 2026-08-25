// Google Calendar OAuth 2.0 redirect endpoint (no JWT: called by Google).
// Validates the single-use state, exchanges the code for tokens server-side,
// stores an AES-GCM encrypted refresh token and redirects back to the app.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  appUrl,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  googleOAuthClient,
  isCalendarAvailableForUser,
  redirectUri,
  safeRedirectPath,
} from "../_shared/google-calendar/config.ts";
import { encryptToken, sha256Hex } from "../_shared/google-calendar/crypto.ts";

function redirect(result: "connected" | "error", path?: string | null) {
  const base = appUrl();
  const target = new URL(`${base}${safeRedirectPath(path)}`);
  target.searchParams.set("tab", "integrations");
  target.searchParams.set("calendar", result);
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError || !code || !state) {
      console.error("oauth callback rejected:", oauthError ?? "missing_code_or_state");
      return redirect("error");
    }

    const admin = adminClient();
    const stateHash = await sha256Hex(state);
    const nowIso = new Date().toISOString();

    // Atomic single-use consumption: only an unused, unexpired state matches.
    const { data: consumed, error: consumeError } = await admin
      .from("google_oauth_states")
      .update({ used_at: nowIso })
      .eq("state_hash", stateHash)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .select("user_id, redirect_path")
      .maybeSingle();

    if (consumeError || !consumed) {
      console.error("invalid, expired or reused oauth state");
      return redirect("error");
    }
    const userId = consumed.user_id as string;
    const backPath = safeRedirectPath(consumed.redirect_path as string | null);

    // Rollout gate is re-checked here: the backend stays the authority.
    if (!(await isCalendarAvailableForUser(admin, userId))) {
      console.error("calendar oauth blocked by rollout gate");
      return redirect("error", backPath);
    }

    const client = googleOAuthClient();
    if (!client) {
      console.error("google calendar oauth is not fully configured");
      return redirect("error", backPath);
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      console.error(`google token exchange failed [${tokenResponse.status}]`);
      return redirect("error", backPath);
    }

    const tokens = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };

    if (!tokens.refresh_token || !tokens.access_token) {
      // Without offline access we cannot keep the connection alive.
      console.error("google token exchange returned an incomplete grant");
      return redirect("error", backPath);
    }

    // Google identity comes from the OpenID Connect userinfo endpoint (validated by
    // Google over TLS), never from the SoMA profile nor an unverified JWT decode.
    const userinfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userinfoResponse.ok) {
      console.error(`google userinfo failed [${userinfoResponse.status}]`);
      return redirect("error", backPath);
    }
    const identity = await userinfoResponse.json() as { sub?: string; email?: string };
    if (!identity.sub) {
      console.error("google userinfo returned no subject");
      return redirect("error", backPath);
    }

    const encrypted = await encryptToken(tokens.refresh_token);
    const grantedScopes = (tokens.scope ?? "").split(/\s+/).filter(Boolean);

    const { error: upsertError } = await admin
      .from("google_calendar_connections")
      .upsert({
        user_id: userId,
        refresh_token_encrypted: encrypted,
        scopes: grantedScopes,
        google_account_id: identity.sub,
        google_account_email: identity.email ?? null,
        status: "connected",
        last_error: null,
        connected_at: nowIso,
        disconnected_at: null,
        updated_at: nowIso,
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("failed to persist google calendar connection:", upsertError.message);
      return redirect("error", backPath);
    }

    return redirect("connected", backPath);
  } catch (e) {
    console.error("google-calendar-oauth-callback failed:", e instanceof Error ? e.message : String(e));
    return redirect("error");
  }
});
