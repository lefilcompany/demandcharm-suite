import { describe, it, expect } from "vitest";
import {
  processInAppReleaseDeliveries,
  buildNotification,
  NOTIFICATION_TYPE_PRODUCT_UPDATE,
  type InAppDeliverySource,
  type NotificationInsert,
  type PendingInAppDelivery,
} from "../../supabase/functions/_shared/processInAppReleaseDeliveries";

const U1 = "11111111-1111-4111-8111-111111111111";
const FEATURE = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const delivery = (id: string, userId = U1): PendingInAppDelivery => ({
  id,
  release_feature_id: FEATURE,
  announcement_key: "ann-1",
  user_id: userId,
  attempts: 0,
});

function makeSource(pending: PendingInAppDelivery[], opts: { missingFeature?: boolean; failInsert?: boolean } = {}) {
  let claimedOnce = false;
  const inserted: NotificationInsert[] = [];
  const sent: string[] = [];
  const failed: Array<{ ids: string[]; error: string }> = [];

  const source: InAppDeliverySource = {
    // Simulates the conditional claim: a second run finds nothing pending.
    claimPendingDeliveries: async (limit) => {
      if (claimedOnce) return [];
      claimedOnce = true;
      return pending.slice(0, limit);
    },
    getFeatures: async () =>
      opts.missingFeature
        ? new Map()
        : new Map([[FEATURE, { id: FEATURE, title: "Novo recurso", summary: "Resumo", cta_path: "/demands" }]]),
    insertNotifications: async (rows) => {
      if (opts.failInsert) throw new Error("insert boom");
      inserted.push(...rows);
    },
    markSent: async (ids) => { sent.push(...ids); },
    markFailed: async (ids, error) => { failed.push({ ids, error }); },
  };

  return { source, inserted, sent, failed };
}

describe("buildNotification", () => {
  it("maps the feature onto the notifications shape", () => {
    const n = buildNotification(delivery("d1"), {
      id: FEATURE,
      title: "T",
      summary: "S",
      cta_path: null,
    });
    expect(n).toEqual({
      user_id: U1,
      title: "T",
      message: "S",
      type: NOTIFICATION_TYPE_PRODUCT_UPDATE,
      read: false,
      link: null,
    });
  });
});

describe("processInAppReleaseDeliveries", () => {
  it("returns an empty summary when nothing is pending", async () => {
    const { source } = makeSource([]);
    expect(await processInAppReleaseDeliveries(source)).toEqual({ claimed: 0, sent: 0, failed: 0 });
  });

  it("inserts notifications and marks the deliveries as sent", async () => {
    const { source, inserted, sent } = makeSource([delivery("d1"), delivery("d2", FEATURE)]);
    const summary = await processInAppReleaseDeliveries(source);
    expect(summary).toEqual({ claimed: 2, sent: 2, failed: 0 });
    expect(inserted).toHaveLength(2);
    expect(sent).toEqual(["d1", "d2"]);
  });

  it("does not reprocess claimed deliveries on a second run", async () => {
    const { source, inserted } = makeSource([delivery("d1")]);
    await processInAppReleaseDeliveries(source);
    const second = await processInAppReleaseDeliveries(source);
    expect(second).toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(inserted).toHaveLength(1);
  });

  it("respects the batch size cap", async () => {
    const many = Array.from({ length: 10 }, (_, i) => delivery(`d${i}`));
    const { source } = makeSource(many);
    const summary = await processInAppReleaseDeliveries(source, { batchSize: 3 });
    expect(summary.claimed).toBe(3);
  });

  it("marks deliveries as failed when the feature is missing", async () => {
    const { source, failed } = makeSource([delivery("d1")], { missingFeature: true });
    const summary = await processInAppReleaseDeliveries(source);
    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(failed[0].error).toBe("release_feature not found");
  });

  it("marks deliveries as failed when the insert throws", async () => {
    const { source, failed } = makeSource([delivery("d1")], { failInsert: true });
    const summary = await processInAppReleaseDeliveries(source);
    expect(summary).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(failed[0].error).toBe("insert boom");
  });
});
