import {
  APP_URL,
  callbackUrl,
  corsHeaders,
  googleClient,
  isCalendarAvailableForUser,
  serviceClient,
} from "../_shared/google-calendar/config.ts";
import { encryptToken, sha256Hex } from "../_shared/google-calendar/crypto.ts";

function redirectTo(path: string, params: Record<string, string>) {
  const url = new URL(path.startsWith("http") ? path : `${APP_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

const FALLBACK_PATH = "/settings?tab=integrations";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  try {
    const supabase = serviceClient();

    // Rollout is revalidated after the state is consumed (user identity needed).


    if (errorParam) {
      return redirectTo(FALLBACK_PATH, {
        calendar: "error",
        reason: errorParam === "access_denied" ? "access_denied" : "google_error",
      });
    }

    if (!code || !state) {
      return redirectTo(FALLBACK_PATH, { calendar: "error", reason: "invalid_request" });
    }

    // Atomic single-use state consumption (no SELECT → UPDATE race window).
    const stateHash = await sha256Hex(state);
    const { data: consumed, error: consumeError } = await supabase
      .from("google_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state_hash", stateHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("user_id, redirect_path")
      .maybeSingle();

    if (consumeError || !consumed) {
      return redirectTo(FALLBACK_PATH, { calendar: "error", reason: "invalid_state" });
    }

    const redirectPath = consumed.redirect_path || FALLBACK_PATH;

    const client = googleClient();
    if (!client) {
      return redirectTo(redirectPath, { calendar: "error", reason: "missing_credentials" });
    }

    // Exchange authorization code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: callbackUrl(),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("Token exchange failed with status", tokenRes.status);
      return redirectTo(redirectPath, { calendar: "error", reason: "token_exchange_failed" });
    }

    const tokens = await tokenRes.json();
    const accessToken: string | undefined = tokens.access_token;
    const refreshToken: string | undefined = tokens.refresh_token;
    const grantedScopes: string[] = typeof tokens.scope === "string" ? tokens.scope.split(" ") : [];

    if (!accessToken) {
      return redirectTo(redirectPath, { calendar: "error", reason: "token_exchange_failed" });
    }

    // Identity via OpenID Connect userinfo (never decode the id_token blindly).
    const userinfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userinfoRes.ok) {
      console.error("Userinfo request failed with status", userinfoRes.status);
      return redirectTo(redirectPath, { calendar: "error", reason: "userinfo_failed" });
    }
    const userinfo = await userinfoRes.json();
    const googleAccountId: string | undefined = userinfo.sub;
    const googleAccountEmail: string | undefined = userinfo.email;

    if (!googleAccountId) {
      return redirectTo(redirectPath, { calendar: "error", reason: "userinfo_failed" });
    }

    // Refresh token is only returned on first consent; keep the existing one otherwise.
    let refreshEncrypted: string | null = null;
    if (refreshToken) {
      try {
        refreshEncrypted = await encryptToken(refreshToken);
      } catch (e) {
        console.error("Encryption failed:", (e as Error).message);
        return redirectTo(redirectPath, { calendar: "error", reason: "encryption_failed" });
      }
    } else {
      const { data: existing } = await supabase
        .from("google_calendar_connections")
        .select("refresh_token_encrypted")
        .eq("user_id", consumed.user_id)
        .maybeSingle();
      refreshEncrypted = existing?.refresh_token_encrypted ?? null;
    }

    if (!refreshEncrypted) {
      return redirectTo(redirectPath, { calendar: "error", reason: "missing_refresh_token" });
    }

    const { error: upsertError } = await supabase
      .from("google_calendar_connections")
      .upsert({
        user_id: consumed.user_id,
        google_account_id: googleAccountId,
        google_account_email: googleAccountEmail ?? null,
        refresh_token_encrypted: refreshEncrypted,
        scopes: grantedScopes,
        status: "connected",
        last_error: null,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Connection upsert failed:", upsertError.message);
      return redirectTo(redirectPath, { calendar: "error", reason: "persist_failed" });
    }

    return redirectTo(redirectPath, { calendar: "connected" });
  } catch (e) {
    console.error("oauth-callback error:", (e as Error).message);
    return redirectTo(FALLBACK_PATH, { calendar: "error", reason: "internal_error" });
  }
});
