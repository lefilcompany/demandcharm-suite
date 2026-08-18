/**
 * process-platform-events
 *
 * Main consumer of the event-driven release architecture.
 * Supported event_type: `deployment.published`.
 *
 * Two clearly separated phases per invocation:
 *
 *   A. EVENT PROCESSING (fast, bounded)
 *      claim events (pending | failed & next_retry_at <= now)
 *      -> handleDeploymentPublished -> createFeatureDeliveries (outbox only)
 *      -> event marked `processed`
 *
 *   B. DELIVERY (bounded, resumable)
 *      processInAppReleaseDeliveries -> processReleaseEmailDeliveries
 *      -> updateReleaseStatuses
 *
 * Phase B is intentionally capped: leftover deliveries stay pending and are
 * picked up by the next run, so an event NEVER sits in `processing` for hours.
 *
 * Manual execution (testing): POST with the service role key (or
 * X-Release-Secret). Body options: { eventId?, dryRun?, batchSize?,
 * emailBatchSize?, emailConcurrency?, skipDeliveries? }.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  handleDeploymentPublished,
  createSupabaseEventProcessingSource,
  type PlatformEventRow,
  type StructuredLogger,
} from "../_shared/handleDeploymentPublished.ts";
import { createSupabaseDeliverySource } from "../_shared/createFeatureDeliveries.ts";
import {
  processInAppReleaseDeliveries,
  createSupabaseInAppDeliverySource,
} from "../_shared/processInAppReleaseDeliveries.ts";
import {
  processReleaseEmailDeliveries,
  createSupabaseEmailDeliverySource,
} from "../_shared/processReleaseEmailDeliveries.ts";
import {
  updateReleaseStatuses,
  createSupabaseReleaseStatusSource,
} from "../_shared/updateReleaseStatuses.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELEASE_EVENT_SECRET = Deno.env.get("RELEASE_EVENT_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_PUBLIC_URL") ?? "https://pla.soma.lefil.com.br";

const EVENT_TYPE = "deployment.published";
const DEFAULT_EVENT_BATCH = 5;
const MAX_EVENT_BATCH = 20;
const MAX_EVENT_ATTEMPTS = 5;
/** attempts (1-based) -> backoff minutes */
const EVENT_BACKOFF_MINUTES = [5, 15, 60, 180];

const log: StructuredLogger = (level, message, ctx = {}) => {
  const line = JSON.stringify({
    fn: "process-platform-events",
    level,
    message,
    ts: new Date().toISOString(),
    ...ctx,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const provided = req.headers.get("x-release-secret") ?? "";
  if (RELEASE_EVENT_SECRET && provided && safeEqual(provided, RELEASE_EVENT_SECRET)) return true;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const apiKey = req.headers.get("apikey") ?? "";
  if (SERVICE_ROLE_KEY && bearer && safeEqual(bearer, SERVICE_ROLE_KEY)) return true;
  if (SERVICE_ROLE_KEY && apiKey && safeEqual(apiKey, SERVICE_ROLE_KEY)) return true;
  return false;
}

function eventRetryAt(attempts: number): string | null {
  if (attempts >= MAX_EVENT_ATTEMPTS) return null;
  const minutes = EVENT_BACKOFF_MINUTES[Math.min(attempts, EVENT_BACKOFF_MINUTES.length) - 1] ?? 5;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

type Client = ReturnType<typeof createClient>;

/** Logical lock: pending|due-failed -> processing, attempts += 1. */
async function claimEvents(
  client: Client,
  limit: number,
  eventId: string | null,
): Promise<PlatformEventRow[]> {
  const nowIso = new Date().toISOString();
  const ids: string[] = [];

  if (eventId) {
    ids.push(eventId);
  } else {
    const { data: pending, error } = await client
      .from("platform_events")
      .select("id")
      .eq("event_type", EVENT_TYPE)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`[platformEvents] pending select: ${error.message}`);
    for (const row of pending ?? []) ids.push(row.id as string);

    if (ids.length < limit) {
      const { data: retryable, error: retryError } = await client
        .from("platform_events")
        .select("id")
        .eq("event_type", EVENT_TYPE)
        .eq("status", "failed")
        .lt("attempts", MAX_EVENT_ATTEMPTS)
        .not("next_retry_at", "is", null)
        .lte("next_retry_at", nowIso)
        .order("next_retry_at", { ascending: true })
        .limit(limit - ids.length);
      if (retryError) throw new Error(`[platformEvents] retry select: ${retryError.message}`);
      for (const row of retryable ?? []) ids.push(row.id as string);
    }
  }

  if (ids.length === 0) return [];

  // Conditional update = logical lock; a concurrent worker gets nothing back.
  const { data: claimed, error: claimError } = await client
    .from("platform_events")
    .update({ status: "processing", last_error: null })
    .in("id", ids)
    .in("status", ["pending", "failed"])
    .select("id, event_type, aggregate_type, aggregate_id, payload, attempts");
  if (claimError) throw new Error(`[platformEvents] claim: ${claimError.message}`);

  const rows = (claimed ?? []) as PlatformEventRow[];
  // attempts += 1 for every claimed event.
  await Promise.all(
    rows.map((row) =>
      client
        .from("platform_events")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id),
    ),
  );
  return rows.map((row) => ({ ...row, attempts: (row.attempts ?? 0) + 1 }));
}

async function markEventProcessed(client: Client, eventId: string) {
  await client
    .from("platform_events")
    .update({ status: "processed", processed_at: new Date().toISOString(), next_retry_at: null })
    .eq("id", eventId);
}

async function markEventFailed(
  client: Client,
  event: PlatformEventRow,
  errorMessage: string,
) {
  await client
    .from("platform_events")
    .update({
      status: "failed",
      last_error: errorMessage.slice(0, 500),
      next_retry_at: eventRetryAt(event.attempts),
    })
    .eq("id", event.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAuthorized(req)) {
    log("warn", "unauthorized invocation");
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : null;
  const batchSize = Math.min(
    Math.max(1, Number(body.batchSize) || DEFAULT_EVENT_BATCH),
    MAX_EVENT_BATCH,
  );
  const skipDeliveries = body.skipDeliveries === true;
  const dryRun = body.dryRun === true;

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deliverySource = createSupabaseDeliverySource(client);
  const eventSource = createSupabaseEventProcessingSource(client, deliverySource);

  // ---------- Phase A: event processing ----------
  let events: PlatformEventRow[] = [];
  try {
    events = dryRun ? [] : await claimEvents(client, batchSize, eventId);
  } catch (err) {
    log("error", "failed to claim events", { error: (err as Error).message });
    return json({ error: "Failed to claim events" }, 500);
  }

  const eventResults: unknown[] = [];
  for (const event of events) {
    if (event.event_type !== EVENT_TYPE) {
      await markEventFailed(client, event, `unsupported event_type ${event.event_type}`);
      log("warn", "unsupported event type", { eventId: event.id, eventType: event.event_type });
      continue;
    }
    try {
      const result = await handleDeploymentPublished(event, eventSource, log);
      if (result.failedFeatures > 0 && result.jobsCreated === 0) {
        await markEventFailed(client, event, "all features failed to create delivery jobs");
        log("error", "event failed", { eventId: event.id, releaseId: result.releaseId });
      } else {
        await markEventProcessed(client, event.id);
        log("info", "event processed", {
          eventId: event.id,
          releaseId: result.releaseId,
          jobsCreated: result.jobsCreated,
          failedFeatures: result.failedFeatures,
        });
      }
      eventResults.push(result);
    } catch (err) {
      const message = (err as Error).message;
      await markEventFailed(client, event, message);
      log("error", "event handler threw", { eventId: event.id, error: message });
      eventResults.push({ eventId: event.id, error: message });
    }
  }

  // ---------- Phase B: bounded delivery ----------
  let inapp = { claimed: 0, sent: 0, failed: 0 };
  let email = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  if (!skipDeliveries && !dryRun) {
    try {
      inapp = await processInAppReleaseDeliveries(createSupabaseInAppDeliverySource(client), {
        batchSize: Number(body.inappBatchSize) || 200,
      });
    } catch (err) {
      log("error", "inapp delivery pass failed", { error: (err as Error).message });
    }

    try {
      email = await processReleaseEmailDeliveries(
        createSupabaseEmailDeliverySource(client, {
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SERVICE_ROLE_KEY,
        }),
        {
          batchSize: Number(body.emailBatchSize) || 50,
          concurrency: Number(body.emailConcurrency) || 5,
          appUrl: APP_URL,
        },
      );
    } catch (err) {
      log("error", "email delivery pass failed", { error: (err as Error).message });
    }
  }

  // ---------- Status reconciliation ----------
  const statusSource = createSupabaseReleaseStatusSource(client);
  const releaseIds = new Set<string>();
  for (const r of eventResults as Array<{ releaseId?: string | null }>) {
    if (r?.releaseId) releaseIds.add(r.releaseId);
  }
  // Also reconcile releases still in flight from previous runs.
  const { data: openReleases } = await client
    .from("platform_releases")
    .select("id")
    .eq("status", "processing")
    .limit(20);
  for (const row of openReleases ?? []) releaseIds.add(row.id as string);

  const releaseStatuses: unknown[] = [];
  for (const releaseId of releaseIds) {
    try {
      const result = await updateReleaseStatuses(releaseId, statusSource);
      releaseStatuses.push(result);
      log("info", "release status updated", {
        releaseId,
        releaseStatus: result.releaseStatus,
      });
    } catch (err) {
      log("error", "failed to update release status", {
        releaseId,
        error: (err as Error).message,
      });
    }
  }

  return json({
    success: true,
    dryRun,
    events: { claimed: events.length, results: eventResults },
    inapp,
    email,
    releases: releaseStatuses,
  });
});
