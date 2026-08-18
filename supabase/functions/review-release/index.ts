/**
 * review-release
 *
 * Admin decision point of the release announcement architecture.
 *
 * Detection (detect-production-release -> ingest-release-event) only REGISTERS
 * a release and its outbox event. Nothing is ever announced until a global
 * admin approves it here. Actions:
 *
 *   - list     : releases awaiting approval (+ their features)
 *   - approve  : marks the release approved and immediately runs
 *                process-platform-events for its pending event
 *   - reject   : marks the release rejected; the event is discarded
 *
 * All existing processing logic is reused as-is; this function only gates it.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "list";

  // ---------- list ----------
  if (action === "list") {
    const status = typeof body.status === "string" ? body.status : "pending_approval";
    const { data: releases, error } = await admin
      .from("platform_releases")
      .select(
        "id, release_key, deployment_id, commit_sha, published_at, created_at, status, approval_status, approved_at, approval_note",
      )
      .eq("approval_status", status)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return json({ error: error.message }, 500);

    const ids = (releases ?? []).map((r) => r.id as string);
    const { data: features } = ids.length
      ? await admin
          .from("release_features")
          .select(
            "id, release_id, announcement_key, title, summary, email_body, cta_path, cta_label, priority, audience_scope, email_enabled, inapp_enabled, status",
          )
          .in("release_id", ids)
      : { data: [] as unknown[] };

    return json({ success: true, releases: releases ?? [], features: features ?? [] });
  }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : "";
  if (!releaseId) return json({ error: "releaseId is required" }, 400);
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

  const { data: release, error: releaseError } = await admin
    .from("platform_releases")
    .select("id, release_key, approval_status")
    .eq("id", releaseId)
    .maybeSingle();
  if (releaseError) return json({ error: releaseError.message }, 500);
  if (!release) return json({ error: "Release não encontrada" }, 404);
  if (release.approval_status !== "pending_approval") {
    return json({ error: `Release já está como "${release.approval_status}"` }, 409);
  }

  // ---------- reject ----------
  if (action === "reject") {
    const { error } = await admin
      .from("platform_releases")
      .update({
        approval_status: "rejected",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_note: note,
        status: "skipped",
      })
      .eq("id", releaseId);
    if (error) return json({ error: error.message }, 500);

    await admin
      .from("platform_events")
      .update({ status: "skipped", processed_at: new Date().toISOString(), next_retry_at: null })
      .eq("aggregate_id", releaseId)
      .in("status", ["pending", "failed"]);

    return json({ success: true, action: "reject", releaseId });
  }

  // ---------- approve ----------
  if (action !== "approve") return json({ error: "Ação inválida" }, 400);

  const { error: approveError } = await admin
    .from("platform_releases")
    .update({
      approval_status: "approved",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      approval_note: note,
    })
    .eq("id", releaseId);
  if (approveError) return json({ error: approveError.message }, 500);

  const { data: event } = await admin
    .from("platform_events")
    .select("id")
    .eq("aggregate_id", releaseId)
    .eq("event_type", "deployment.published")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const processResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-platform-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(event?.id ? { eventId: event.id } : {}),
  });
  const processResult = await processResponse.json().catch(() => ({}));

  return json({
    success: true,
    action: "approve",
    releaseId,
    eventId: event?.id ?? null,
    processing: processResult,
  });
});
