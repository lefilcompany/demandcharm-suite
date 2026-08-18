/**
 * createFeatureDeliveries (shared backend module)
 *
 * Turns a `release_features` row into `release_deliveries` rows (outbox).
 * Nothing is sent here — this step only materializes the delivery plan.
 *
 * Decision order (per user, per channel):
 *   1. user has access?            -> resolveFeatureAudience
 *   2. feature allows the channel? -> inapp_enabled / email_enabled
 *   3. priority allows the channel?-> PRIORITY_CHANNELS (no delivery row when not allowed)
 *   4. user enabled the channel?   -> notification preferences (productUpdates)
 *                                     -> delivery created with status 'skipped'
 *   5. create delivery ('pending')
 *
 * Priority NEVER overrides an explicit opt-out of `productUpdates`.
 *
 * All queries are batched: one audience resolution, chunked preference reads,
 * chunked upserts. No Auth Admin calls, no per-user query.
 */

import {
  resolveFeatureAudience,
  createSupabaseAudienceSource,
  type AudienceDataSource,
  type FeatureAudienceInput,
} from "./resolveFeatureAudience.ts";

export type DeliveryChannel = "email" | "inapp";
export type FeaturePriority = "critical" | "high" | "normal" | "low";

export interface ReleaseFeatureInput extends FeatureAudienceInput {
  id: string;
  announcement_key: string;
  priority?: string | null;
  email_enabled?: boolean | null;
  inapp_enabled?: boolean | null;
}

export interface DeliveryRow {
  release_feature_id: string;
  announcement_key: string;
  user_id: string;
  channel: DeliveryChannel;
  priority: FeaturePriority;
  status: "pending" | "skipped";
  last_error: string | null;
}

export interface CreateFeatureDeliveriesSummary {
  audience: number;
  emailPending: number;
  inappPending: number;
  skippedPreferences: number;
}

export interface DeliveryDataSource extends AudienceDataSource {
  /** Batched read of `user_preferences` (notification_preferences) for many users. */
  getNotificationPreferences(userIds: string[]): Promise<Map<string, Record<string, unknown>>>;
  /** Idempotent write on (announcement_key, user_id, channel). */
  upsertDeliveries(rows: DeliveryRow[]): Promise<void>;
}

export const PREFERENCE_DISABLED_REASON = "notification preference disabled";
const PRODUCT_UPDATES_KEY = "productUpdates";
const CHUNK = 500;

/** Channels a priority is allowed to use (before feature/user filters). */
export const PRIORITY_CHANNELS: Record<FeaturePriority, DeliveryChannel[]> = {
  critical: ["inapp", "email"],
  high: ["inapp", "email"],
  normal: ["inapp", "email"], // email additionally requires email_enabled = true
  low: ["inapp"],
};

function normalizePriority(value: unknown): FeaturePriority {
  return value === "critical" || value === "high" || value === "low" ? value : "normal";
}

/**
 * Reads the user's opt-in for `productUpdates` on a channel.
 * Supports both the current (`channels.<channel>`) and the legacy formats.
 * Missing data = enabled (undefined means enabled; only `false` disables).
 */
export function isChannelEnabledForProductUpdates(
  prefs: Record<string, unknown> | undefined | null,
  channel: DeliveryChannel,
): boolean {
  if (!prefs || typeof prefs !== "object") return true;

  const channels = prefs.channels as Record<string, unknown> | undefined;
  if (channels && typeof channels === "object") {
    const ch = channels[channel] as Record<string, unknown> | undefined;
    if (ch && typeof ch === "object") {
      if (ch.enabled === false) return false;
      const types = ch.types as Record<string, unknown> | undefined;
      if (types && typeof types === "object" && types[PRODUCT_UPDATES_KEY] === false) return false;
    }
    return true;
  }

  // Legacy format: only the channel-level master switch exists.
  if (channel === "email" && prefs.emailNotifications === false) return false;
  return true;
}

/** Pure planner — no IO, fully testable. */
export function planFeatureDeliveries(
  feature: ReleaseFeatureInput,
  userIds: string[],
  preferences: Map<string, Record<string, unknown>>,
): { rows: DeliveryRow[]; summary: CreateFeatureDeliveriesSummary } {
  const priority = normalizePriority(feature.priority);
  const allowedByPriority = PRIORITY_CHANNELS[priority];

  const featureAllows: Record<DeliveryChannel, boolean> = {
    inapp: feature.inapp_enabled !== false,
    // normal only mails when the feature explicitly opted in
    email: feature.email_enabled === true || (priority !== "normal" && feature.email_enabled !== false),
  };

  const rows: DeliveryRow[] = [];
  const summary: CreateFeatureDeliveriesSummary = {
    audience: userIds.length,
    emailPending: 0,
    inappPending: 0,
    skippedPreferences: 0,
  };

  for (const userId of userIds) {
    const prefs = preferences.get(userId);
    for (const channel of allowedByPriority) {
      if (!featureAllows[channel]) continue; // feature disabled this channel
      const enabled = isChannelEnabledForProductUpdates(prefs, channel);
      if (!enabled) {
        summary.skippedPreferences += 1;
        rows.push({
          release_feature_id: feature.id,
          announcement_key: feature.announcement_key,
          user_id: userId,
          channel,
          priority,
          status: "skipped",
          last_error: PREFERENCE_DISABLED_REASON,
        });
        continue;
      }
      if (channel === "email") summary.emailPending += 1;
      else summary.inappPending += 1;
      rows.push({
        release_feature_id: feature.id,
        announcement_key: feature.announcement_key,
        user_id: userId,
        channel,
        priority,
        status: "pending",
        last_error: null,
      });
    }
  }

  return { rows, summary };
}

/** Full flow: audience -> batched preferences -> idempotent deliveries. */
export async function createFeatureDeliveries(
  feature: ReleaseFeatureInput,
  source: DeliveryDataSource,
): Promise<CreateFeatureDeliveriesSummary> {
  const audience = await resolveFeatureAudience(feature, source);
  if (audience.userIds.length === 0) {
    return { audience: 0, emailPending: 0, inappPending: 0, skippedPreferences: 0 };
  }

  const preferences = await source.getNotificationPreferences(audience.userIds);
  const { rows, summary } = planFeatureDeliveries(feature, audience.userIds, preferences);

  if (rows.length > 0) await source.upsertDeliveries(rows);
  return summary;
}

/** Minimal structural type so this file stays dependency-free. */
interface SupabaseLike {
  from(table: string): any;
}

/** Production data source backed by the service-role Supabase client. */
export function createSupabaseDeliverySource(client: SupabaseLike): DeliveryDataSource {
  const audienceSource = createSupabaseAudienceSource(client);

  return {
    ...audienceSource,

    async getNotificationPreferences(userIds) {
      const map = new Map<string, Record<string, unknown>>();
      for (let i = 0; i < userIds.length; i += CHUNK) {
        const slice = userIds.slice(i, i + CHUNK);
        const { data, error } = await client
          .from("user_preferences")
          .select("user_id, preference_value")
          .eq("preference_key", "notification_preferences")
          .in("user_id", slice);
        if (error) throw new Error(`[createFeatureDeliveries] user_preferences: ${error.message}`);
        for (const row of data ?? []) {
          const value = row?.preference_value;
          if (row?.user_id && value && typeof value === "object") {
            map.set(row.user_id as string, value as Record<string, unknown>);
          }
        }
      }
      return map;
    },

    async upsertDeliveries(rows) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await client
          .from("release_deliveries")
          .upsert(slice, {
            onConflict: "announcement_key,user_id,channel",
            ignoreDuplicates: true,
          });
        if (error) throw new Error(`[createFeatureDeliveries] release_deliveries: ${error.message}`);
      }
    },
  };
}
