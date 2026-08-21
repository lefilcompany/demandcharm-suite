import {
  corsHeaders,
  isCalendarAvailableForUser,
  json,
  requireUser,
  serviceClient,
} from "../_shared/google-calendar/config.ts";
import { decryptToken } from "../_shared/google-calendar/crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await requireUser(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const supabase = serviceClient();

    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    if (!connection) return json({ success: true, status: "revoked" });

    if (connection.refresh_token_encrypted) {
      try {
        const refreshToken = await decryptToken(connection.refresh_token_encrypted);
        const res = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }),
        });
        if (!res.ok) {
          console.warn("Google revoke returned status", res.status);
        }
      } catch (e) {
        console.warn("Revoke skipped:", (e as Error).message);
      }
    }

    const { error } = await supabase
      .from("google_calendar_connections")
      .update({
        status: "revoked",
        refresh_token_encrypted: null,
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Disconnect update failed:", error.message);
      return json({ error: "PERSIST_FAILED" }, 500);
    }

    return json({ success: true, status: "revoked" });
  } catch (e) {
    console.error("disconnect error:", (e as Error).message);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
