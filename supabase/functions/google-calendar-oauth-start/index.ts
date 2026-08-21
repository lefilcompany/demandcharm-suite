import {
  callbackUrl,
  corsHeaders,
  GOOGLE_SCOPES,
  googleClient,
  isCalendarEnabled,
  json,
  requireUser,
  serviceClient,
} from "../_shared/google-calendar/config.ts";
import { randomState, sha256Hex } from "../_shared/google-calendar/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireUser(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const supabase = serviceClient();

    // Feature flag revalidated server-side on every start.
    if (!(await isCalendarEnabled(supabase))) {
      return json({ error: "FEATURE_DISABLED" }, 403);
    }

    const client = googleClient();
    if (!client) return json({ error: "MISSING_GOOGLE_CREDENTIALS" }, 503);

    let redirectPath = "/settings?tab=integrations";
    try {
      const body = await req.json();
      if (typeof body?.redirect_path === "string" && body.redirect_path.startsWith("/")) {
        redirectPath = body.redirect_path;
      }
    } catch (_) {
      // no body is fine
    }

    const state = randomState();
    const stateHash = await sha256Hex(state);

    const { error: insertError } = await supabase
      .from("google_oauth_states")
      .insert({ user_id: userId, state_hash: stateHash, redirect_path: redirectPath });

    if (insertError) {
      console.error("Failed to persist oauth state:", insertError.message);
      return json({ error: "STATE_PERSIST_FAILED" }, 500);
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", client.clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return json({ authorization_url: authUrl.toString() });
  } catch (e) {
    console.error("oauth-start error:", (e as Error).message);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
