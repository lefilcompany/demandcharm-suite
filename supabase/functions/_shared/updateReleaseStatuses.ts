/**
 * updateReleaseStatuses (shared backend module)
 *
 * Derives `release_features.status` from its deliveries and
 * `platform_releases.status` from its features. Pure decision functions +
 * a Supabase-backed runner, so the rules can be unit tested in isolation.
 *
 * Feature rules:
 *   - any delivery still pending/processing (or retryable failed) -> stays `processing`
 *   - all terminal and none failed                                -> `completed`
 *   - some sent/skipped AND some definitively failed              -> `partial_failed`
 *   - everything definitively failed (no success at all)          -> `failed`
 *   - no deliveries at all (nobody to notify)                     -> `skipped`
 *
 * Release rules: same shape applied over its features.
 */

import { MAX_EMAIL_DELIVERY_ATTEMPTS } from "./processReleaseEmailDeliveries.ts";

export type DeliveryStatus = "pending" | "processing" | "sent" | "skipped" | "failed";
export type FeatureStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial_failed"
  | "skipped"
  | "failed";
export type ReleaseStatus = "detected" | "processing" | "completed" | "partial_failed" | "failed";

export interface DeliveryStateRow {
  status: DeliveryStatus;
  attempts: number;
}

/** A failed delivery is only terminal once it has burned all its retries. */
export function isTerminalFailure(row: DeliveryStateRow): boolean {
  return row.status === "failed" && row.attempts >= MAX_EMAIL_DELIVERY_ATTEMPTS;
}

export function computeFeatureStatus(deliveries: DeliveryStateRow[]): FeatureStatus {
  if (deliveries.length === 0) return "skipped";

  let succeeded = 0;
  let terminalFailed = 0;
  let inFlight = 0;

  for (const d of deliveries) {
    if (d.status === "sent" || d.status === "skipped") succeeded++;
    else if (isTerminalFailure(d)) terminalFailed++;
    else inFlight++;
  }

  if (inFlight > 0) return "processing";
  if (terminalFailed === 0) return "completed";
  if (succeeded === 0) return "failed";
  return "partial_failed";
}

export function computeReleaseStatus(featureStatuses: FeatureStatus[]): ReleaseStatus {
  if (featureStatuses.length === 0) return "completed";
  if (featureStatuses.some((s) => s === "pending" || s === "processing")) return "processing";
  if (featureStatuses.every((s) => s === "failed")) return "failed";
  if (featureStatuses.some((s) => s === "failed" || s === "partial_failed")) return "partial_failed";
  return "completed";
}

export interface ReleaseStatusSource {
  /** Features of the release (id + current status). */
  getFeatures(releaseId: string): Promise<Array<{ id: string; status: FeatureStatus }>>;
  /** Delivery states grouped by release_feature_id. */
  getDeliveryStates(featureIds: string[]): Promise<Map<string, DeliveryStateRow[]>>;
  updateFeatureStatus(featureId: string, status: FeatureStatus): Promise<void>;
  updateReleaseStatus(releaseId: string, status: ReleaseStatus): Promise<void>;
}

export interface UpdateReleaseStatusesResult {
  releaseId: string;
  releaseStatus: ReleaseStatus;
  features: Array<{ featureId: string; status: FeatureStatus }>;
}

export async function updateReleaseStatuses(
  releaseId: string,
  source: ReleaseStatusSource,
): Promise<UpdateReleaseStatusesResult> {
  const features = await source.getFeatures(releaseId);
  const considered = features.filter((f) => f.status !== "skipped");
  const states = await source.getDeliveryStates(considered.map((f) => f.id));

  const results: Array<{ featureId: string; status: FeatureStatus }> = [];

  for (const feature of considered) {
    const next = computeFeatureStatus(states.get(feature.id) ?? []);
    if (next !== feature.status) await source.updateFeatureStatus(feature.id, next);
    results.push({ featureId: feature.id, status: next });
  }

  const allStatuses: FeatureStatus[] = features.map((f) => {
    const updated = results.find((r) => r.featureId === f.id);
    return updated ? updated.status : f.status;
  });

  const releaseStatus = computeReleaseStatus(allStatuses.filter((s) => s !== "skipped"));
  await source.updateReleaseStatus(releaseId, releaseStatus);

  return { releaseId, releaseStatus, features: results };
}

/** Minimal structural type so this file stays dependency-free. */
interface SupabaseLike {
  from(table: string): any;
}

const CHUNK = 500;

export function createSupabaseReleaseStatusSource(client: SupabaseLike): ReleaseStatusSource {
  return {
    async getFeatures(releaseId) {
      const { data, error } = await client
        .from("release_features")
        .select("id, status")
        .eq("release_id", releaseId);
      if (error) throw new Error(`[releaseStatus] features: ${error.message}`);
      return (data ?? []) as Array<{ id: string; status: FeatureStatus }>;
    },

    async getDeliveryStates(featureIds) {
      const map = new Map<string, DeliveryStateRow[]>();
      for (let i = 0; i < featureIds.length; i += CHUNK) {
        const { data, error } = await client
          .from("release_deliveries")
          .select("release_feature_id, status, attempts")
          .in("release_feature_id", featureIds.slice(i, i + CHUNK));
        if (error) throw new Error(`[releaseStatus] deliveries: ${error.message}`);
        for (const row of data ?? []) {
          const key = row.release_feature_id as string;
          const list = map.get(key) ?? [];
          list.push({ status: row.status as DeliveryStatus, attempts: Number(row.attempts ?? 0) });
          map.set(key, list);
        }
      }
      return map;
    },

    async updateFeatureStatus(featureId, status) {
      const terminal = status === "completed" || status === "failed" || status === "partial_failed";
      const { error } = await client
        .from("release_features")
        .update({ status, ...(terminal ? { processed_at: new Date().toISOString() } : {}) })
        .eq("id", featureId);
      if (error) throw new Error(`[releaseStatus] updateFeature: ${error.message}`);
    },

    async updateReleaseStatus(releaseId, status) {
      const terminal = status === "completed" || status === "failed" || status === "partial_failed";
      const { error } = await client
        .from("platform_releases")
        .update({ status, ...(terminal ? { processed_at: new Date().toISOString() } : {}) })
        .eq("id", releaseId);
      if (error) throw new Error(`[releaseStatus] updateRelease: ${error.message}`);
    },
  };
}
