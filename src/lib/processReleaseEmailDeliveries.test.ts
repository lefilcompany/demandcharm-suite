import { describe, it, expect } from "vitest";
import {
  processReleaseEmailDeliveries,
  buildSendEmailPayload,
  nextRetryAt,
  MAX_EMAIL_DELIVERY_ATTEMPTS,
  type EmailDeliveryFeature,
  type EmailDeliverySource,
  type PendingEmailDelivery,
  type SendEmailOutcome,
  type SendEmailPayload,
} from "../../supabase/functions/_shared/processReleaseEmailDeliveries";

const U = (n: number) => `1111111${n}-1111-4111-8111-111111111111`;
const FEATURE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const feature: EmailDeliveryFeature = {
  id: FEATURE_ID,
  title: "Projetos por quadro",
  summary: "Resumo curto",
  email_body: "Corpo completo do e-mail",
  cta_path: "/demands",
  cta_label: "Ver projetos",
};

function delivery(n: number, attempts = 0): PendingEmailDelivery {
  return {
    id: `d${n}`,
    release_feature_id: FEATURE_ID,
    announcement_key: "rel-1:feat-1",
    user_id: U(n),
    attempts,
  };
}

function makeSource(
  deliveries: PendingEmailDelivery[],
  send: (p: SendEmailPayload) => Promise<SendEmailOutcome> | SendEmailOutcome,
) {
  const calls: SendEmailPayload[] = [];
  const sent: string[] = [];
  const skipped: Array<[string, string]> = [];
  const failed: Array<[string, number, string, string | null]> = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const source: EmailDeliverySource = {
    claimPendingDeliveries: async () => deliveries,
    getFeatures: async () => new Map([[FEATURE_ID, feature]]),
    sendEmail: async (p) => {
      calls.push(p);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        return await send(p);
      } finally {
        inFlight--;
      }
    },
    markSent: async (id) => void sent.push(id),
    markSkipped: async (id, reason) => void skipped.push([id, reason]),
    markFailed: async (id, attempts, error, retryAt) =>
      void failed.push([id, attempts, error, retryAt]),
  };

  return { source, calls, sent, skipped, failed, maxInFlight: () => maxInFlight };
}

describe("buildSendEmailPayload", () => {
  it("always targets user_id and builds an absolute actionUrl", () => {
    const p = buildSendEmailPayload(delivery(1), feature, "https://pla.soma.lefil.com.br/");
    expect(p.to).toBe(U(1));
    expect(p.eventType).toBe("productUpdates");
    expect(p.subject).toBe("Novidade no SoMA+: Projetos por quadro");
    expect(p.templateData.actionUrl).toBe("https://pla.soma.lefil.com.br/demands");
    expect(p.templateData.message).toBe("Corpo completo do e-mail");
    expect(p.templateData.actionText).toBe("Ver projetos");
    expect(p.templateData.type).toBe("success");
  });

  it("falls back to summary and default CTA label", () => {
    const p = buildSendEmailPayload(
      delivery(2),
      { ...feature, email_body: null, cta_label: null, cta_path: null },
      "https://pla.soma.lefil.com.br",
    );
    expect(p.templateData.message).toBe("Resumo curto");
    expect(p.templateData.actionText).toBe("Conhecer novidade");
    expect(p.templateData.actionUrl).toBeUndefined();
  });
});

describe("nextRetryAt", () => {
  it("uses exponential backoff and stops after the max attempts", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    expect(nextRetryAt(1, base)).toBe("2026-01-01T00:05:00.000Z");
    expect(nextRetryAt(2, base)).toBe("2026-01-01T00:15:00.000Z");
    expect(nextRetryAt(3, base)).toBe("2026-01-01T01:00:00.000Z");
    expect(nextRetryAt(MAX_EMAIL_DELIVERY_ATTEMPTS, base)).toBeNull();
  });
});

describe("processReleaseEmailDeliveries", () => {
  it("returns zeros when there is nothing pending", async () => {
    const { source } = makeSource([], () => ({ kind: "sent" }));
    expect(await processReleaseEmailDeliveries(source)).toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("sends every delivery and marks them sent", async () => {
    const items = [delivery(1), delivery(2), delivery(3)];
    const s = makeSource(items, () => ({ kind: "sent" }));
    const res = await processReleaseEmailDeliveries(s.source);
    expect(res).toEqual({ processed: 3, sent: 3, skipped: 0, failed: 0 });
    expect(s.sent).toHaveLength(3);
  });

  it("records skipped when send-email reports a preference skip", async () => {
    const s = makeSource([delivery(1)], () => ({ kind: "skipped", reason: "preference" }));
    const res = await processReleaseEmailDeliveries(s.source);
    expect(res).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(s.skipped[0][1]).toBe("preference");
  });

  it("does not block other recipients when one fails", async () => {
    const items = [delivery(1), delivery(2), delivery(3)];
    const s = makeSource(items, (p) =>
      p.to === U(2) ? { kind: "failed", error: "boom" } : { kind: "sent" },
    );
    const res = await processReleaseEmailDeliveries(s.source);
    expect(res).toEqual({ processed: 3, sent: 2, skipped: 0, failed: 1 });
    expect(s.failed[0][1]).toBe(1);
    expect(s.failed[0][3]).not.toBeNull();
  });

  it("stops scheduling retries after the attempt limit", async () => {
    const s = makeSource([delivery(1, MAX_EMAIL_DELIVERY_ATTEMPTS - 1)], () => ({
      kind: "failed",
      error: "boom",
    }));
    await processReleaseEmailDeliveries(s.source);
    expect(s.failed[0][1]).toBe(MAX_EMAIL_DELIVERY_ATTEMPTS);
    expect(s.failed[0][3]).toBeNull();
  });

  it("caps concurrency", async () => {
    const items = Array.from({ length: 20 }, (_, i) => delivery(i % 9));
    const s = makeSource(items, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { kind: "sent" };
    });
    await processReleaseEmailDeliveries(s.source, { concurrency: 4 });
    expect(s.maxInFlight()).toBeLessThanOrEqual(4);
    expect(s.calls).toHaveLength(20);
  });

  it("marks failed without retry when the feature is missing", async () => {
    const s = makeSource([delivery(1)], () => ({ kind: "sent" }));
    s.source.getFeatures = async () => new Map();
    const res = await processReleaseEmailDeliveries(s.source);
    expect(res).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(s.failed[0][2]).toBe("release_feature not found");
    expect(s.failed[0][3]).toBeNull();
  });
});
