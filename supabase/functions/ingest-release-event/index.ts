/**
 * ingest-release-event
 *
 * Entry point of the event-driven release announcement architecture.
 *
 * Responsibilities (and nothing else):
 *  1. Authenticate the caller (X-Release-Secret or service role key).
 *  2. Validate payload + full release manifest.
 *  3. Persist platform_releases (idempotent by release_key).
 *  4. Persist release_features (skipping announcement_keys already announced).
 *  5. Append a pending platform_events row (outbox).
 *
 * It NEVER queries users, resolves audience, sends email/push or creates
 * notifications — dedicated consumers handle that.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  validateReleaseManifest,
  formatManifestIssues,
  type ReleaseFeature,
} from "../_shared/releaseManifest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELEASE_EVENT_SECRET = Deno.env.get("RELEASE_EVENT_SECRET") ?? "";

const EVENT_TYPE = "deployment.published";

function log(level: "info" | "warn" | "error", message: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    fn: "ingest-release-event",
    level,
    message,
    ts: new Date().toISOString(),
    ...ctx,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Constant-time-ish string comparison to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const provided = req.headers.get("x-release-secret") ?? "";
  if (RELEASE_EVENT_SECRET && provided && safeEqual(provided, RELEASE_EVENT_SECRET)) return true;

  // Internal calls using the service role key.
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const apiKey = req.headers.get("apikey") ?? "";
  if (SERVICE_ROLE_KEY && bearer && safeEqual(bearer, SERVICE_ROLE_KEY)) return true;
  if (SERVICE_ROLE_KEY && apiKey && safeEqual(apiKey, SERVICE_ROLE_KEY)) return true;

  return false;
}

function isOptionalString(value: unknown, max = 200): value is string | undefined {
  return value === undefined || value === null || (typeof value === "string" && value.length <= max);
}

function featureRow(releaseId: string, feature: ReleaseFeature) {
  return {
    release_id: releaseId,
    announcement_key: feature.announcementKey,
    feature_key: feature.featureKey,
    title: feature.title,
    summary: feature.summary,
    email_body: feature.emailBody ?? null,
    cta_path: feature.ctaPath ?? null,
    cta_label: feature.ctaLabel ?? null,
    image_url: feature.imageUrl ?? null,
    priority: feature.priority,
    audience_scope: feature.audience.scope,
    global_roles: feature.audience.globalRoles,
    team_roles: feature.audience.teamRoles,
    board_roles: feature.audience.boardRoles,
    team_id: feature.audience.teamId,
    board_id: feature.audience.boardId,
    email_enabled: feature.channels.email,
    inapp_enabled: feature.channels.inapp,
    status: "pending",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!isAuthorized(req)) {
    log("warn", "unauthorized ingest attempt");
    return json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ error: "Body must be a JSON object" }, 400);
  }
  const raw = body as Record<string, unknown>;

  if (raw.eventType !== EVENT_TYPE) {
    return json({ error: `eventType must be "${EVENT_TYPE}"` }, 400);
  }
  if (typeof raw.releaseKey !== "string" || raw.releaseKey.trim() === "" || raw.releaseKey.length > 200) {
    return json({ error: "releaseKey is required (max 200 chars)" }, 400);
  }
  if (!isOptionalString(raw.deploymentId) || !isOptionalString(raw.commitSha)) {
    return json({ error: "deploymentId/commitSha must be short strings when provided" }, 400);
  }
  let publishedAt: string | null = null;
  if (raw.publishedAt !== undefined && raw.publishedAt !== null && raw.publishedAt !== "") {
    if (typeof raw.publishedAt !== "string" || Number.isNaN(Date.parse(raw.publishedAt))) {
      return json({ error: "publishedAt must be an ISO timestamp" }, 400);
    }
    publishedAt = new Date(raw.publishedAt).toISOString();
  }

  const manifestResult = validateReleaseManifest(raw.manifest);
  if (!manifestResult.success) {
    log("warn", "invalid manifest", { releaseKey: raw.releaseKey });
    return json(
      { error: "Invalid release manifest", details: formatManifestIssues(manifestResult.issues) },
      400,
    );
  }
  const manifest = manifestResult.data;

  const releaseKey = raw.releaseKey.trim();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Idempotency: release_key already ingested ---
  const { data: existingRelease, error: existingError } = await supabase
    .from("platform_releases")
    .select("id")
    .eq("release_key", releaseKey)
    .maybeSingle();

  if (existingError) {
    log("error", "failed to look up release", { releaseKey, error: existingError.message });
    return json({ error: "Failed to look up release" }, 500);
  }

  if (existingRelease) {
    log("info", "duplicate release ignored", { releaseKey, releaseId: existingRelease.id });
    return json({ success: true, duplicate: true, releaseId: existingRelease.id });
  }

  // --- Create release ---
  // Announcements are never sent automatically: a global admin must approve
  // the release. `autoApprove` exists only for internal/admin test flows.
  const autoApprove = raw.autoApprove === true;

  const { data: release, error: releaseError } = await supabase
    .from("platform_releases")
    .insert({
      release_key: releaseKey,
      deployment_id: (raw.deploymentId as string | undefined) ?? null,
      commit_sha: (raw.commitSha as string | undefined) ?? null,
      published_at: publishedAt,
      status: "detected",
      approval_status: autoApprove ? "approved" : "pending_approval",
      approved_at: autoApprove ? new Date().toISOString() : null,
    })

    .select("id")
    .maybeSingle();

  if (releaseError || !release) {
    // Concurrent ingest of the same key hits the unique constraint.
    if (releaseError?.code === "23505") {
      const { data: raced } = await supabase
        .from("platform_releases")
        .select("id")
        .eq("release_key", releaseKey)
        .maybeSingle();
      log("info", "duplicate release (race)", { releaseKey, releaseId: raced?.id });
      return json({ success: true, duplicate: true, releaseId: raced?.id ?? null });
    }
    log("error", "failed to create release", { releaseKey, error: releaseError?.message });
    return json({ error: "Failed to create release" }, 500);
  }

  const releaseId = release.id as string;
  log("info", "release created", { releaseId, releaseKey, features: manifest.features.length });

  // --- Features: announcement_key is globally unique (already announced = skip) ---
  const announcementKeys = manifest.features.map((f) => f.announcementKey);
  const skippedExistingAnnouncements: string[] = [];
  let insertedFeatures: string[] = [];

  if (announcementKeys.length > 0) {
    const { data: alreadyAnnounced, error: announcedError } = await supabase
      .from("release_features")
      .select("announcement_key")
      .in("announcement_key", announcementKeys);

    if (announcedError) {
      log("error", "failed to check existing announcements", { releaseId, error: announcedError.message });
      return json({ error: "Failed to check existing announcements" }, 500);
    }

    const existingKeys = new Set((alreadyAnnounced ?? []).map((r) => r.announcement_key as string));
    const toInsert = manifest.features.filter((f) => {
      if (existingKeys.has(f.announcementKey)) {
        skippedExistingAnnouncements.push(f.announcementKey);
        return false;
      }
      return true;
    });

    if (toInsert.length > 0) {
      const { data: inserted, error: featureError } = await supabase
        .from("release_features")
        .insert(toInsert.map((f) => featureRow(releaseId, f)))
        .select("announcement_key");

      if (featureError) {
        log("error", "failed to insert features", { releaseId, error: featureError.message });
        await supabase
          .from("platform_releases")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", releaseId);
        return json({ error: "Failed to insert release features" }, 500);
      }
      insertedFeatures = (inserted ?? []).map((r) => r.announcement_key as string);
    }
  }

  if (skippedExistingAnnouncements.length > 0) {
    log("info", "skipped already announced features", {
      releaseId,
      skipped: skippedExistingAnnouncements,
    });
  }

  // --- Outbox event (no secrets in the payload) ---
  const { data: event, error: eventError } = await supabase
    .from("platform_events")
    .insert({
      event_type: EVENT_TYPE,
      aggregate_type: "release",
      aggregate_id: releaseId,
      status: "pending",
      payload: {
        releaseId,
        releaseKey,
        manifestVersion: manifest.version,
        announcementKeys: insertedFeatures,
        skippedAnnouncementKeys: skippedExistingAnnouncements,
        publishedAt,
      },
    })
    .select("id")
    .maybeSingle();

  if (eventError || !event) {
    log("error", "failed to create outbox event", { releaseId, error: eventError?.message });
    return json({ error: "Failed to create platform event" }, 500);
  }

  const eventId = event.id as string;
  log("info", "ingest completed", {
    releaseId,
    eventId,
    featureCount: insertedFeatures.length,
    skippedCount: skippedExistingAnnouncements.length,
  });

  return json({
    success: true,
    duplicate: false,
    releaseId,
    eventId,
    featureCount: insertedFeatures.length,
    skippedExistingAnnouncements,
  });
});
