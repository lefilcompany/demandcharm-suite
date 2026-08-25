// Disconnects the signed-in user's own Google Calendar connection.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  GOOGLE_REVOKE_ENDPOINT,
  userClient,
} from "../_shared/google-calendar/config.ts";
import { decryptToken } from "../_shared/google-calendar/crypto.ts";

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

    const { data: connection } = await admin
      .from("google_calendar_connections")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    if (connection?.refresh_token_encrypted) {
      // Best-effort revocation at Google; local removal happens regardless.
      try {
        const refreshToken = await decryptToken(connection.refresh_token_encrypted as string);
        const res = await fetch(GOOGLE_REVOKE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }),
        });
        if (!res.ok) console.error(`google revoke returned status ${res.status}`);
      } catch (e) {
        console.error("google revoke failed:", e instanceof Error ? e.message : String(e));
      }
    }

    const { error: deleteError } = await admin
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("failed to delete connection:", deleteError.message);
      return json({ error: "disconnect_failed" }, 500);
    }

    await admin.from("google_oauth_states").delete().eq("user_id", userId);

    return json({ connected: false });
  } catch (e) {
    console.error("google-calendar-disconnect failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "internal_error" }, 500);
  }
});
