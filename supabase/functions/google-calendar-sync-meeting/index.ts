// Sync a demand meeting with Google Calendar (SoMA -> Google only).
// Requires an authenticated caller who is the meeting organizer.
// No token value is ever logged or returned to the browser.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { appUrl, getAccessToken, isAutoAcceptEnabled, isGoogleCalendarEnabled } from "../_shared/google-calendar/config.ts";


const CALENDAR_ID = "primary";
const BACKOFF_MINUTES = [0, 1, 5, 15, 60];

type Action = "sync" | "cancel" | "verify";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Deterministic Google event id derived from the meeting uuid (base32 chars only). */
function deterministicEventId(meetingId: string): string {
  const hex = meetingId.replace(/-/g, "");
  let out = "";
  // hex chars are all valid base32hex-ish; Google requires [a-v0-9], length 5..1024
  for (const ch of hex) out += ch >= "0" && ch <= "9" ? ch : ch.toLowerCase();
  return `soma${out}`;
}

function nextRetryAt(attempts: number): string | null {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Google datetime in the meeting timezone (RFC3339 with offset from the stored instant). */
function toRfc3339(iso: string): string {
  return new Date(iso).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let meetingId = "";
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({})) as { meeting_id?: string; action?: Action };
    meetingId = (body.meeting_id ?? "").trim();
    const action: Action = body.action === "cancel" || body.action === "verify" ? body.action : "sync";
    if (!/^[0-9a-f-]{36}$/i.test(meetingId)) return json({ error: "invalid_meeting_id" }, 400);

    const { data: meeting, error: meetingError } = await admin
      .from("demand_meetings")
      .select("*")
      .eq("id", meetingId)
      .maybeSingle();
    if (meetingError || !meeting) return json({ error: "meeting_not_found" }, 404);

    // Permission: caller must be able to access the demand AND be the organizer.
    const { data: canAccess } = await admin.rpc("can_access_demand", {
      _user_id: userId,
      _demand_id: meeting.demand_id,
    });
    if (!canAccess) return json({ error: "forbidden" }, 403);
    // "verify" is read-only: any user with access to the demand may run it.
    // Only write actions (sync/cancel) are restricted to the organizer.
    if (action !== "verify" && meeting.organizer_user_id !== userId) {
      return json({ error: "not_organizer" }, 403);
    }

    if (!isGoogleCalendarEnabled()) {
      return json({ skipped: true, reason: "google_calendar_disabled", sync_status: meeting.sync_status });
    }

    // Organizer's Google connection only.
    const { data: connection } = await admin
      .from("google_calendar_connections")
      .select("refresh_token_encrypted, status")
      .eq("user_id", meeting.organizer_user_id)
      .maybeSingle();

    if (!connection || connection.status !== "connected") {
      await admin.from("demand_meetings")
        .update({ sync_status: "not_connected", next_retry_at: null })
        .eq("id", meetingId);
      return json({ sync_status: "not_connected" });
    }

    if (action === "sync") {
      await admin.from("demand_meetings").update({ sync_status: "syncing" }).eq("id", meetingId);
    }

    const { decryptToken } = await import("../_shared/google-calendar/crypto.ts");
    const accessToken = await getAccessToken(await decryptToken(connection.refresh_token_encrypted));

    const { data: demand } = await admin
      .from("demands")
      .select("id, title, description, sequence_number")
      .eq("id", meeting.demand_id)
      .maybeSingle();

    const { data: participants } = await admin
      .from("demand_meeting_participants")
      .select("id, meeting_id, user_id, email, calendar_sync_status, sync_attempts")
      .eq("meeting_id", meetingId);

    const participantRows = (participants ?? []) as Array<{ id: string; user_id: string | null; email: string; calendar_sync_status: string; sync_attempts: number }>;
    const validEmails = Array.from(new Set(participantRows.map((participant) => participant.email.trim().toLowerCase()).filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))));
    const attendees = validEmails.map((email) => ({ email }));

    const eventId = meeting.google_event_id || deterministicEventId(meetingId);
    const base = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // ---------- verify (read-only, never creates an event) ----------
    if (action === "verify") {
      if (!meeting.google_event_id) {
        return json({ verified: false, reason: "no_event_id", sync_status: meeting.sync_status });
      }
      const res = await fetch(`${base}/${meeting.google_event_id}`, {
        method: "GET",
        headers: authHeaders,
      });
      if (res.status === 404 || res.status === 410) {
        await admin.from("demand_meetings").update({
          sync_status: "failed",
          last_sync_error: `verify [${res.status}] event_missing_on_google`,
          last_verified_at: new Date().toISOString(),
        }).eq("id", meetingId);
        return json({ verified: false, status: res.status, sync_status: "failed" });
      }
      if (!res.ok) {
        const text = await res.text();
        return json({ verified: false, status: res.status, details: text, sync_status: meeting.sync_status });
      }
      const ev = await res.json() as {
        id?: string;
        htmlLink?: string;
        status?: string;
        organizer?: { email?: string };
      };
      const cancelledOnGoogle = ev.status === "cancelled";
      await admin.from("demand_meetings").update({
        google_event_url: ev.htmlLink ?? meeting.google_event_url,
        google_organizer_email: ev.organizer?.email ?? meeting.google_organizer_email,
        sync_status: cancelledOnGoogle ? "failed" : meeting.sync_status,
        last_sync_error: cancelledOnGoogle ? "verify: event cancelled on Google" : null,
        last_verified_at: new Date().toISOString(),
      }).eq("id", meetingId);
      return json({
        verified: !cancelledOnGoogle,
        event_id: ev.id,
        google_event_url: ev.htmlLink ?? null,
        google_organizer_email: ev.organizer?.email ?? null,
        sync_status: cancelledOnGoogle ? "failed" : meeting.sync_status,
      });
    }

    // ---------- cancel ----------
    if (action === "cancel") {
      if (meeting.google_event_id) {
        const res = await fetch(`${base}/${meeting.google_event_id}?sendUpdates=all`, {
          method: "DELETE",
          headers: authHeaders,
        });
        if (!res.ok && res.status !== 404 && res.status !== 410) {
          const text = await res.text();
          console.error(JSON.stringify({
            meeting_id: meetingId, demand_id: meeting.demand_id,
            operation: "cancel", google_status: res.status, attempt: meeting.sync_attempts + 1,
          }));
          const attempts = meeting.sync_attempts + 1;
          await admin.from("demand_meetings").update({
            sync_status: res.status >= 500 || res.status === 429 ? "pending" : "failed",
            sync_attempts: attempts,
            last_sync_error: `cancel [${res.status}] ${text.slice(0, 300)}`,
            next_retry_at: nextRetryAt(attempts),
          }).eq("id", meetingId);
          return json({ sync_status: "failed", status: res.status, details: text }, 200);
        }
      }
      await admin.from("demand_meeting_participants").update({
        calendar_sync_status: "removed", next_retry_at: null,
      }).eq("meeting_id", meetingId);
      await admin.from("demand_meetings").update({
        sync_status: "cancelled",
        next_retry_at: null,
        last_sync_error: null,
        last_synced_at: new Date().toISOString(),
      }).eq("id", meetingId);
      return json({ sync_status: "cancelled" });
    }

    // ---------- insert / patch ----------
    const demandUrl = `${appUrl()}/demands/${meeting.demand_id}`;
    const descriptionParts = [
      demand?.description ? String(demand.description).replace(/<[^>]+>/g, " ").trim().slice(0, 2000) : "",
      `Demanda no SoMA: ${demandUrl}`,
    ].filter(Boolean);

    const eventBody: Record<string, unknown> = {
      summary: demand?.title ?? "Reunião",
      description: descriptionParts.join("\n\n"),
      start: { dateTime: toRfc3339(meeting.starts_at), timeZone: meeting.timezone },
      end: { dateTime: toRfc3339(meeting.ends_at), timeZone: meeting.timezone },
      attendees,
      extendedProperties: {
        private: { somaMeetingId: meetingId, somaDemandId: meeting.demand_id },
      },
    };

    if (meeting.create_google_meet && !meeting.google_meet_url) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `soma-${meetingId}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const isUpdate = !!meeting.google_event_id;
    let res = await fetch(
      isUpdate
        ? `${base}/${eventId}?conferenceDataVersion=1&sendUpdates=all`
        : `${base}?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: isUpdate ? "PATCH" : "POST",
        headers: authHeaders,
        body: JSON.stringify(isUpdate ? eventBody : { ...eventBody, id: eventId }),
      },
    );

    // Idempotency: the deterministic id already exists -> patch it instead.
    if (!isUpdate && (res.status === 409)) {
      res = await fetch(`${base}/${eventId}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(eventBody),
      });
    }

    if (!res.ok) {
      const text = await res.text();
      const retriable = res.status === 429 || res.status >= 500;
      const attempts = meeting.sync_attempts + 1;
      console.error(JSON.stringify({
        meeting_id: meetingId, demand_id: meeting.demand_id,
        operation: isUpdate ? "patch" : "insert", google_status: res.status, attempt: attempts,
      }));
      await admin.from("demand_meetings").update({
        sync_status: retriable ? "pending" : "failed",
        sync_attempts: attempts,
        last_sync_error: `[${res.status}] ${text.slice(0, 300)}`,
        next_retry_at: retriable ? nextRetryAt(attempts) : null,
      }).eq("id", meetingId);
      return json({ sync_status: retriable ? "pending" : "failed", status: res.status, details: text });
    }

    const event = await res.json() as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      status?: string;
      iCalUID?: string;
      organizer?: { email?: string };
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[]; createRequest?: { status?: { statusCode?: string } } };
    };

    // A 2xx from insert/patch is not proof the event is retrievable: confirm with a
    // read-only events.get (never creates a second event).
    const confirmId = event.id ?? eventId;
    const confirmRes = await fetch(`${base}/${confirmId}`, { method: "GET", headers: authHeaders });
    const confirmed = await confirmRes.json().catch(() => ({})) as {
      id?: string;
      htmlLink?: string;
      status?: string;
      iCalUID?: string;
      organizer?: { email?: string };
    };
    const eventUsable = confirmRes.ok && !!confirmed.id && confirmed.status !== "cancelled" &&
      !!(confirmed.htmlLink ?? event.htmlLink);

    if (!eventUsable) {
      const attempts = meeting.sync_attempts + 1;
      console.error(JSON.stringify({
        meeting_id: meetingId, demand_id: meeting.demand_id,
        operation: "verify_after_write", google_status: confirmRes.status,
      }));
      await admin.from("demand_meetings").update({
        google_event_id: confirmId,
        sync_status: "failed",
        sync_attempts: attempts,
        last_sync_error: `verify_after_write [${confirmRes.status}] event_not_retrievable`,
        next_retry_at: null,
        last_verified_at: new Date().toISOString(),
      }).eq("id", meetingId);
      return json({ sync_status: "failed", status: confirmRes.status, reason: "event_not_retrievable" });
    }

    const meetUri = event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;
    const meetPending = meeting.create_google_meet && !meetUri;
    const organizerEmail = confirmed.organizer?.email ?? event.organizer?.email ?? null;
    const eventUrl = confirmed.htmlLink ?? event.htmlLink ?? null;

    await admin.from("demand_meetings").update({
      google_calendar_id: CALENDAR_ID,
      google_event_id: confirmId,
      google_event_url: eventUrl,
      google_organizer_email: organizerEmail,
      google_ical_uid: confirmed.iCalUID ?? event.iCalUID ?? meeting.google_ical_uid ?? null,
      google_meet_url: meetUri,
      meet_status: !meeting.create_google_meet ? "none" : (meetUri ? "ready" : "pending"),
      sync_status: "synced",
      sync_attempts: 0,
      last_sync_error: null,
      next_retry_at: meetPending ? nextRetryAt(1) : null,
      last_synced_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    }).eq("id", meetingId);

    await admin.from("demand_meeting_participants").update({
      calendar_sync_status: "invited",
      next_retry_at: null,
    }).eq("meeting_id", meetingId).neq("user_id", meeting.organizer_user_id);

    console.log(JSON.stringify({
      meeting_id: meetingId, demand_id: meeting.demand_id,
      operation: isUpdate ? "patch" : "insert", google_status: res.status, sync_status: "synced",
    }));

    return json({
      sync_status: "synced",
      meet_status: !meeting.create_google_meet ? "none" : (meetUri ? "ready" : "pending"),
      google_event_url: eventUrl,
      google_organizer_email: organizerEmail,
      google_meet_url: meetUri,
    });
  } catch (e) {
    const reauth = (e as { reauth?: boolean })?.reauth === true;
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ meeting_id: meetingId, operation: "sync", error: message }));
    if (meetingId) {
      await admin.from("demand_meetings").update({
        sync_status: reauth ? "reauth_required" : "failed",
        last_sync_error: message.slice(0, 300),
        next_retry_at: null,
      }).eq("id", meetingId);
    }
    return json({ sync_status: reauth ? "reauth_required" : "failed", error: message }, 200);
  }
});
