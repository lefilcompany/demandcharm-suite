/**
 * processInAppReleaseDeliveries (shared backend module)
 *
 * Consumer for the `inapp` channel of `release_deliveries`.
 * Reuses the existing `public.notifications` table — no parallel notification
 * storage, no schema change.
 *
 * Idempotency: the delivery row itself is the source of truth. Each delivery is
 * *claimed* with a conditional update `pending -> processing` (guarded by
 * `status = 'pending'`); only rows the claim actually returned are processed,
 * so a concurrent or repeated run never inserts the same notification twice.
 *
 * Bounded work: one invocation processes at most `batchSize` deliveries
 * (default 100, hard cap 500).
 */

export const NOTIFICATION_TYPE_PRODUCT_UPDATE = "product_update";

const DEFAULT_BATCH = 100;
const MAX_BATCH = 500;

export interface PendingInAppDelivery {
  id: string;
  release_feature_id: string;
  announcement_key: string;
  user_id: string;
  attempts: number;
}

export interface DeliveryFeature {
  id: string;
  title: string;
  summary: string;
  cta_path: string | null;
}

export interface NotificationInsert {
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
}

export interface InAppDeliverySource {
  /** Claims up to `limit` pending inapp deliveries (pending -> processing). */
  claimPendingDeliveries(limit: number): Promise<PendingInAppDelivery[]>;
  /** Batched read of the related release_features rows. */
  getFeatures(featureIds: string[]): Promise<Map<string, DeliveryFeature>>;
  /** Inserts notifications (one per delivery, already de-duplicated by the claim). */
  insertNotifications(rows: NotificationInsert[]): Promise<void>;
  markSent(deliveryIds: string[]): Promise<void>;
  markFailed(deliveryIds: string[], error: string): Promise<void>;
}

export interface ProcessInAppSummary {
  claimed: number;
  sent: number;
  failed: number;
}

export function buildNotification(
  delivery: PendingInAppDelivery,
  feature: DeliveryFeature,
): NotificationInsert {
  return {
    user_id: delivery.user_id,
    title: feature.title,
    message: feature.summary,
    type: NOTIFICATION_TYPE_PRODUCT_UPDATE,
    read: false,
    link: feature.cta_path ?? null,
  };
}

export async function processInAppReleaseDeliveries(
  source: InAppDeliverySource,
  options: { batchSize?: number } = {},
): Promise<ProcessInAppSummary> {
  const limit = Math.min(Math.max(1, options.batchSize ?? DEFAULT_BATCH), MAX_BATCH);
  const claimed = await source.claimPendingDeliveries(limit);
  if (claimed.length === 0) return { claimed: 0, sent: 0, failed: 0 };

  const featureIds = Array.from(new Set(claimed.map((d) => d.release_feature_id)));
  let features: Map<string, DeliveryFeature>;
  try {
    features = await source.getFeatures(featureIds);
  } catch (err) {
    await source.markFailed(claimed.map((d) => d.id), (err as Error).message);
    return { claimed: claimed.length, sent: 0, failed: claimed.length };
  }

  const rows: NotificationInsert[] = [];
  const okIds: string[] = [];
  const missingIds: string[] = [];

  for (const delivery of claimed) {
    const feature = features.get(delivery.release_feature_id);
    if (!feature) {
      missingIds.push(delivery.id);
      continue;
    }
    rows.push(buildNotification(delivery, feature));
    okIds.push(delivery.id);
  }

  let sent = 0;
  let failed = missingIds.length;

  if (missingIds.length > 0) {
    await source.markFailed(missingIds, "release_feature not found");
  }

  if (rows.length > 0) {
    try {
      await source.insertNotifications(rows);
      await source.markSent(okIds);
      sent = okIds.length;
    } catch (err) {
      await source.markFailed(okIds, (err as Error).message);
      failed += okIds.length;
    }
  }

  return { claimed: claimed.length, sent, failed };
}

/** Minimal structural type so this file stays dependency-free. */
interface SupabaseLike {
  from(table: string): any;
}

const CHUNK = 500;

/** Production data source backed by the service-role Supabase client. */
export function createSupabaseInAppDeliverySource(client: SupabaseLike): InAppDeliverySource {
  return {
    async claimPendingDeliveries(limit) {
      const { data: candidates, error } = await client
        .from("release_deliveries")
        .select("id")
        .eq("channel", "inapp")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`[inappDeliveries] select: ${error.message}`);
      const ids = (candidates ?? []).map((r: { id: string }) => r.id);
      if (ids.length === 0) return [];

      // Conditional claim — only rows still pending are returned.
      const { data: claimed, error: claimError } = await client
        .from("release_deliveries")
        .update({ status: "processing" })
        .in("id", ids)
        .eq("status", "pending")
        .select("id, release_feature_id, announcement_key, user_id, attempts");
      if (claimError) throw new Error(`[inappDeliveries] claim: ${claimError.message}`);
      return (claimed ?? []) as PendingInAppDelivery[];
    },

    async getFeatures(featureIds) {
      const map = new Map<string, DeliveryFeature>();
      for (let i = 0; i < featureIds.length; i += CHUNK) {
        const slice = featureIds.slice(i, i + CHUNK);
        const { data, error } = await client
          .from("release_features")
          .select("id, title, summary, cta_path")
          .in("id", slice);
        if (error) throw new Error(`[inappDeliveries] release_features: ${error.message}`);
        for (const row of data ?? []) map.set(row.id as string, row as DeliveryFeature);
      }
      return map;
    },

    async insertNotifications(rows) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await client.from("notifications").insert(rows.slice(i, i + CHUNK));
        if (error) throw new Error(`[inappDeliveries] notifications: ${error.message}`);
      }
    },

    async markSent(deliveryIds) {
      if (deliveryIds.length === 0) return;
      const nowIso = new Date().toISOString();
      for (let i = 0; i < deliveryIds.length; i += CHUNK) {
        const { error } = await client
          .from("release_deliveries")
          .update({ status: "sent", sent_at: nowIso, last_error: null })
          .in("id", deliveryIds.slice(i, i + CHUNK));
        if (error) throw new Error(`[inappDeliveries] markSent: ${error.message}`);
      }
      await bumpAttempts(client, deliveryIds);
    },

    async markFailed(deliveryIds, errorMessage) {
      if (deliveryIds.length === 0) return;
      for (let i = 0; i < deliveryIds.length; i += CHUNK) {
        const { error } = await client
          .from("release_deliveries")
          .update({ status: "failed", last_error: errorMessage.slice(0, 500) })
          .in("id", deliveryIds.slice(i, i + CHUNK));
        if (error) throw new Error(`[inappDeliveries] markFailed: ${error.message}`);
      }
      await bumpAttempts(client, deliveryIds);
    },
  };
}

/** attempts += 1 without a per-row query (single RPC, best effort). */
async function bumpAttempts(client: SupabaseLike & { rpc?: any }, deliveryIds: string[]) {
  if (typeof (client as any).rpc !== "function") return;
  const { error } = await (client as any).rpc("increment_release_delivery_attempts", {
    p_ids: deliveryIds,
  });
  if (error) console.warn(`[inappDeliveries] attempts: ${error.message}`);
}
