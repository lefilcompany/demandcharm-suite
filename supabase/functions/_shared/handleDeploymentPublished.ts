/**
 * handleDeploymentPublished (shared backend module)
 *
 * EVENT PROCESSING ONLY — this step never sends anything.
 * It turns a `deployment.published` platform_event into delivery *jobs*:
 *
 *   event -> release (detected -> processing)
 *         -> for each pending release_feature: createFeatureDeliveries (outbox)
 *         -> event marked `processed`
 *
 * The actual delivery (inapp/email consumers) runs separately and may span
 * several invocations, so an event is never left `processing` for hours.
 */

import {
  createFeatureDeliveries,
  type DeliveryDataSource,
  type CreateFeatureDeliveriesSummary,
} from "./createFeatureDeliveries.ts";

export interface PlatformEventRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface ReleaseRow {
  id: string;
  release_key: string;
  status: string;
}

export interface FeatureRow {
  id: string;
  release_id: string;
  announcement_key: string;
  audience_scope: string;
  global_roles: string[] | null;
  team_roles: string[] | null;
  board_roles: string[] | null;
  team_id: string | null;
  board_id: string | null;
  priority: string | null;
  email_enabled: boolean | null;
  inapp_enabled: boolean | null;
  status: string;
}

export interface EventProcessingSource {
  getReleaseForEvent(event: PlatformEventRow): Promise<ReleaseRow | null>;
  markReleaseProcessing(releaseId: string): Promise<void>;
  /** Features of the release still awaiting job creation (status = pending). */
  getPendingFeatures(releaseId: string): Promise<FeatureRow[]>;
  /** True when deliveries were already materialized for this announcement_key. */
  hasExistingDeliveries(announcementKey: string): Promise<boolean>;
  setFeatureStatus(featureId: string, status: "processing" | "skipped" | "failed"): Promise<void>;
  deliverySource: DeliveryDataSource;
}

export interface FeatureJobResult {
  featureId: string;
  announcementKey: string;
  status: "processing" | "skipped" | "failed";
  summary?: CreateFeatureDeliveriesSummary;
  error?: string;
}

export interface HandleDeploymentPublishedResult {
  eventId: string;
  releaseId: string | null;
  features: FeatureJobResult[];
  jobsCreated: number;
  failedFeatures: number;
}

export type StructuredLogger = (
  level: "info" | "warn" | "error",
  message: string,
  ctx?: Record<string, unknown>,
) => void;

const noopLog: StructuredLogger = () => {};

export async function handleDeploymentPublished(
  event: PlatformEventRow,
  source: EventProcessingSource,
  log: StructuredLogger = noopLog,
): Promise<HandleDeploymentPublishedResult> {
  const release = await source.getReleaseForEvent(event);
  if (!release) {
    throw new Error(`release not found for event ${event.id}`);
  }

  log("info", "processing release", {
    eventId: event.id,
    releaseId: release.id,
    releaseKey: release.release_key,
  });

  if (release.status === "detected") {
    await source.markReleaseProcessing(release.id);
  }

  const features = await source.getPendingFeatures(release.id);
  const results: FeatureJobResult[] = [];
  let jobsCreated = 0;
  let failedFeatures = 0;

  // Sequential on purpose: each feature resolves an audience and writes a batch.
  for (const feature of features) {
    const ctx = {
      eventId: event.id,
      releaseId: release.id,
      featureId: feature.id,
      announcementKey: feature.announcement_key,
    };

    try {
      if (await source.hasExistingDeliveries(feature.announcement_key)) {
        await source.setFeatureStatus(feature.id, "skipped");
        log("info", "announcement already processed, skipping", ctx);
        results.push({
          featureId: feature.id,
          announcementKey: feature.announcement_key,
          status: "skipped",
        });
        continue;
      }

      await source.setFeatureStatus(feature.id, "processing");
      const summary = await createFeatureDeliveries(
        {
          id: feature.id,
          announcement_key: feature.announcement_key,
          audience_scope: feature.audience_scope,
          global_roles: feature.global_roles,
          team_roles: feature.team_roles,
          board_roles: feature.board_roles,
          team_id: feature.team_id,
          board_id: feature.board_id,
          priority: feature.priority,
          email_enabled: feature.email_enabled,
          inapp_enabled: feature.inapp_enabled,
        } as any,
        source.deliverySource,
      );

      jobsCreated += summary.emailPending + summary.inappPending;
      results.push({
        featureId: feature.id,
        announcementKey: feature.announcement_key,
        status: "processing",
        summary,
      });
      log("info", "delivery jobs created", { ...ctx, ...summary });
    } catch (err) {
      failedFeatures++;
      const message = (err as Error).message;
      await source.setFeatureStatus(feature.id, "failed").catch(() => {});
      results.push({
        featureId: feature.id,
        announcementKey: feature.announcement_key,
        status: "failed",
        error: message,
      });
      log("error", "failed to create delivery jobs", { ...ctx, error: message });
    }
  }

  return {
    eventId: event.id,
    releaseId: release.id,
    features: results,
    jobsCreated,
    failedFeatures,
  };
}

/** Minimal structural type so this file stays dependency-free. */
interface SupabaseLike {
  from(table: string): any;
}

export function createSupabaseEventProcessingSource(
  client: SupabaseLike,
  deliverySource: DeliveryDataSource,
): EventProcessingSource {
  return {
    async getReleaseForEvent(event) {
      const releaseKey =
        typeof event.payload?.releaseKey === "string" ? (event.payload.releaseKey as string) : null;

      let query = client.from("platform_releases").select("id, release_key, status");
      query =
        event.aggregate_type === "platform_release"
          ? query.eq("id", event.aggregate_id)
          : query.eq("release_key", releaseKey ?? event.aggregate_id);

      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(`[platformEvents] release lookup: ${error.message}`);
      return (data as ReleaseRow | null) ?? null;
    },

    async markReleaseProcessing(releaseId) {
      const { error } = await client
        .from("platform_releases")
        .update({ status: "processing" })
        .eq("id", releaseId)
        .eq("status", "detected");
      if (error) throw new Error(`[platformEvents] release processing: ${error.message}`);
    },

    async getPendingFeatures(releaseId) {
      const { data, error } = await client
        .from("release_features")
        .select(
          "id, release_id, announcement_key, audience_scope, global_roles, team_roles, board_roles, team_id, board_id, priority, email_enabled, inapp_enabled, status",
        )
        .eq("release_id", releaseId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw new Error(`[platformEvents] features: ${error.message}`);
      return (data ?? []) as FeatureRow[];
    },

    async hasExistingDeliveries(announcementKey) {
      const { data, error } = await client
        .from("release_deliveries")
        .select("id")
        .eq("announcement_key", announcementKey)
        .limit(1);
      if (error) throw new Error(`[platformEvents] deliveries check: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async setFeatureStatus(featureId, status) {
      const { error } = await client
        .from("release_features")
        .update({ status })
        .eq("id", featureId);
      if (error) throw new Error(`[platformEvents] feature status: ${error.message}`);
    },

    deliverySource,
  };
}
