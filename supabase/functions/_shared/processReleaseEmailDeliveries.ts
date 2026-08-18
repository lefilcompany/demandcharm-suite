/**
 * processReleaseEmailDeliveries (shared backend module)
 *
 * Consumer for the `email` channel of `release_deliveries`.
 *
 * Flow: release delivery -> processReleaseEmailDeliveries -> send-email -> Resend.
 * There is NO second Resend integration here: every message goes through the
 * existing `send-email` Edge Function (invoked with the service role key), which
 * keeps template rendering, dedupe logging and preference checks in one place.
 *
 * Recipient is ALWAYS `delivery.user_id` — never an email coming from a manifest.
 * `send-email` resolves the address through Supabase Auth.
 *
 * Concurrency is bounded (default 5, max 10) — no `Promise.all` over every user.
 */

const DEFAULT_BATCH = 50;
const MAX_BATCH = 200;
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 10;

export const MAX_EMAIL_DELIVERY_ATTEMPTS = 5;

/** Backoff per attempt number (1-based) in minutes. */
const BACKOFF_MINUTES = [5, 15, 60, 180];

export function nextRetryAt(attempts: number, from: Date = new Date()): string | null {
  if (attempts >= MAX_EMAIL_DELIVERY_ATTEMPTS) return null;
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] ??
    BACKOFF_MINUTES[0];
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export interface PendingEmailDelivery {
  id: string;
  release_feature_id: string;
  announcement_key: string;
  user_id: string;
  attempts: number;
}

export interface EmailDeliveryFeature {
  id: string;
  title: string;
  summary: string;
  email_body: string | null;
  cta_path: string | null;
  cta_label: string | null;
  image_url?: string | null;
}

export interface SendEmailPayload {
  to: string;
  eventType: string;
  subject: string;
  template: "product_update";
  templateData: {
    title: string;
    message: string;
    actionText: string;
    actionUrl?: string;
    imageUrl?: string;
    type: "success";
  };
  dedupeKey: string;
  sourceFunction: string;
  relatedEntityType: string;
  relatedEntityId: string;
}


export type SendEmailOutcome =
  | { kind: "sent" }
  | { kind: "skipped"; reason?: string }
  | { kind: "failed"; error: string };

export interface EmailDeliverySource {
  claimPendingDeliveries(limit: number): Promise<PendingEmailDelivery[]>;
  getFeatures(featureIds: string[]): Promise<Map<string, EmailDeliveryFeature>>;
  /** Calls the existing send-email Edge Function with the service role key. */
  sendEmail(payload: SendEmailPayload): Promise<SendEmailOutcome>;
  markSent(deliveryId: string, attempts: number): Promise<void>;
  markSkipped(deliveryId: string, reason: string): Promise<void>;
  markFailed(
    deliveryId: string,
    attempts: number,
    error: string,
    retryAt: string | null,
  ): Promise<void>;
}

export interface ProcessEmailSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export function buildSendEmailPayload(
  delivery: PendingEmailDelivery,
  feature: EmailDeliveryFeature,
  appUrl: string,
): SendEmailPayload {
  const actionUrl = feature.cta_path ? absoluteUrl(appUrl, feature.cta_path) : undefined;
  return {
    to: delivery.user_id,
    eventType: "productUpdates",
    subject: `Novidade no SoMA+: ${feature.title}`,
    template: "product_update",
    templateData: {
      title: feature.title,
      message: feature.email_body || feature.summary,
      actionText: feature.cta_label || "Conhecer novidade",
      ...(actionUrl ? { actionUrl } : {}),
      ...(feature.image_url ? { imageUrl: feature.image_url } : {}),
      type: "success",
    },
    dedupeKey: `release:${delivery.announcement_key}:${delivery.user_id}`,
    sourceFunction: "processReleaseEmailDeliveries",
    relatedEntityType: "release_feature",
    relatedEntityId: feature.id,
  };
}

export function absoluteUrl(appUrl: string, ctaPath: string): string {
  const base = appUrl.replace(/\/+$/, "");
  const path = ctaPath.startsWith("/") ? ctaPath : `/${ctaPath}`;
  return `${base}${path}`;
}

export async function processReleaseEmailDeliveries(
  source: EmailDeliverySource,
  options: { batchSize?: number; concurrency?: number; appUrl?: string } = {},
): Promise<ProcessEmailSummary> {
  const limit = Math.min(Math.max(1, options.batchSize ?? DEFAULT_BATCH), MAX_BATCH);
  const concurrency = Math.min(
    Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY),
    MAX_CONCURRENCY,
  );
  const appUrl = options.appUrl ?? "https://pla.soma.lefil.com.br";

  const claimed = await source.claimPendingDeliveries(limit);
  const summary: ProcessEmailSummary = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  if (claimed.length === 0) return summary;

  let features: Map<string, EmailDeliveryFeature>;
  try {
    features = await source.getFeatures(
      Array.from(new Set(claimed.map((d) => d.release_feature_id))),
    );
  } catch (err) {
    for (const d of claimed) {
      const attempts = d.attempts + 1;
      await source.markFailed(d.id, attempts, (err as Error).message, nextRetryAt(attempts));
      summary.processed++;
      summary.failed++;
    }
    return summary;
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < claimed.length) {
      const delivery = claimed[cursor++];
      // One failure must never block the other recipients.
      try {
        await processOne(delivery, features, source, appUrl, summary);
      } catch (err) {
        summary.processed++;
        summary.failed++;
        const attempts = delivery.attempts + 1;
        await source
          .markFailed(delivery.id, attempts, (err as Error).message, nextRetryAt(attempts))
          .catch(() => {});
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, claimed.length) }, () => worker()),
  );

  return summary;
}

async function processOne(
  delivery: PendingEmailDelivery,
  features: Map<string, EmailDeliveryFeature>,
  source: EmailDeliverySource,
  appUrl: string,
  summary: ProcessEmailSummary,
) {
  summary.processed++;
  const feature = features.get(delivery.release_feature_id);
  if (!feature) {
    const attempts = delivery.attempts + 1;
    await source.markFailed(delivery.id, attempts, "release_feature not found", null);
    summary.failed++;
    return;
  }

  const outcome = await source.sendEmail(buildSendEmailPayload(delivery, feature, appUrl));

  if (outcome.kind === "sent") {
    await source.markSent(delivery.id, delivery.attempts + 1);
    summary.sent++;
    return;
  }
  if (outcome.kind === "skipped") {
    await source.markSkipped(delivery.id, outcome.reason ?? "skipped by send-email");
    summary.skipped++;
    return;
  }
  const attempts = delivery.attempts + 1;
  await source.markFailed(delivery.id, attempts, outcome.error, nextRetryAt(attempts));
  summary.failed++;
}

/** Minimal structural type so this file stays dependency-free. */
interface SupabaseLike {
  from(table: string): any;
}

const CHUNK = 500;

export function createSupabaseEmailDeliverySource(
  client: SupabaseLike,
  config: { supabaseUrl: string; serviceRoleKey: string },
): EmailDeliverySource {
  return {
    async claimPendingDeliveries(limit) {
      const nowIso = new Date().toISOString();
      const { data: candidates, error } = await client
        .from("release_deliveries")
        .select("id")
        .eq("channel", "email")
        .eq("status", "pending")
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`[emailDeliveries] select: ${error.message}`);
      const ids = (candidates ?? []).map((r: { id: string }) => r.id);

      // Retryable rows: previously failed with a due next_retry_at and attempts left.
      if (ids.length < limit) {
        const { data: retryables, error: retryError } = await client
          .from("release_deliveries")
          .select("id")
          .eq("channel", "email")
          .eq("status", "failed")
          .lt("attempts", MAX_EMAIL_DELIVERY_ATTEMPTS)
          .not("next_retry_at", "is", null)
          .lte("next_retry_at", nowIso)
          .order("next_retry_at", { ascending: true })
          .limit(limit - ids.length);
        if (retryError) throw new Error(`[emailDeliveries] retry select: ${retryError.message}`);
        for (const r of retryables ?? []) ids.push((r as { id: string }).id);
      }

      if (ids.length === 0) return [];

      const { data: claimed, error: claimError } = await client
        .from("release_deliveries")
        .update({ status: "processing" })
        .in("id", ids)
        .in("status", ["pending", "failed"])
        .select("id, release_feature_id, announcement_key, user_id, attempts");
      if (claimError) throw new Error(`[emailDeliveries] claim: ${claimError.message}`);
      return (claimed ?? []) as PendingEmailDelivery[];
    },


    async getFeatures(featureIds) {
      const map = new Map<string, EmailDeliveryFeature>();
      for (let i = 0; i < featureIds.length; i += CHUNK) {
        const { data, error } = await client
          .from("release_features")
          .select("id, title, summary, email_body, cta_path, cta_label, image_url")
          .in("id", featureIds.slice(i, i + CHUNK));
        if (error) throw new Error(`[emailDeliveries] release_features: ${error.message}`);
        for (const row of data ?? []) map.set(row.id as string, row as EmailDeliveryFeature);
      }
      return map;
    },

    async sendEmail(payload) {
      try {
        const res = await fetch(`${config.supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.serviceRoleKey}`,
            apikey: config.serviceRoleKey,
          },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let body: any = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = null;
        }
        if (!res.ok) {
          return { kind: "failed", error: `send-email ${res.status}: ${text.slice(0, 300)}` };
        }
        if (body?.skipped) {
          return { kind: "skipped", reason: String(body.reason ?? "skipped") };
        }
        return { kind: "sent" };
      } catch (err) {
        return { kind: "failed", error: (err as Error).message };
      }
    },

    async markSent(deliveryId, attempts) {
      const { error } = await client
        .from("release_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts,
          last_error: null,
          next_retry_at: null,
        })
        .eq("id", deliveryId);
      if (error) throw new Error(`[emailDeliveries] markSent: ${error.message}`);
    },

    async markSkipped(deliveryId, reason) {
      const { error } = await client
        .from("release_deliveries")
        .update({ status: "skipped", last_error: reason.slice(0, 500), next_retry_at: null })
        .eq("id", deliveryId);
      if (error) throw new Error(`[emailDeliveries] markSkipped: ${error.message}`);
    },

    async markFailed(deliveryId, attempts, errorMessage, retryAt) {
      // Exhausted retries stay `failed` with no next_retry_at, for auditing.
      const { error } = await client
        .from("release_deliveries")
        .update({
          status: "failed",
          attempts,
          last_error: errorMessage.slice(0, 500),
          next_retry_at: attempts >= MAX_EMAIL_DELIVERY_ATTEMPTS ? null : retryAt,
        })
        .eq("id", deliveryId);
      if (error) throw new Error(`[emailDeliveries] markFailed: ${error.message}`);
    },
  };
}
