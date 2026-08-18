import { describe, it, expect } from "vitest";
import {
  computeFeatureStatus,
  computeReleaseStatus,
  updateReleaseStatuses,
  type DeliveryStateRow,
  type FeatureStatus,
  type ReleaseStatusSource,
} from "../../supabase/functions/_shared/updateReleaseStatuses";
import { MAX_EMAIL_DELIVERY_ATTEMPTS } from "../../supabase/functions/_shared/processReleaseEmailDeliveries";

const sent = (): DeliveryStateRow => ({ status: "sent", attempts: 1 });
const skipped = (): DeliveryStateRow => ({ status: "skipped", attempts: 0 });
const pending = (): DeliveryStateRow => ({ status: "pending", attempts: 0 });
const retryable = (): DeliveryStateRow => ({ status: "failed", attempts: 1 });
const deadFailed = (): DeliveryStateRow => ({
  status: "failed",
  attempts: MAX_EMAIL_DELIVERY_ATTEMPTS,
});

describe("computeFeatureStatus", () => {
  it("is skipped when there is no delivery at all", () => {
    expect(computeFeatureStatus([])).toBe("skipped");
  });

  it("stays processing while deliveries are pending or retryable", () => {
    expect(computeFeatureStatus([sent(), pending()])).toBe("processing");
    expect(computeFeatureStatus([sent(), retryable()])).toBe("processing");
  });

  it("is completed when everything is sent or skipped", () => {
    expect(computeFeatureStatus([sent(), skipped(), sent()])).toBe("completed");
  });

  it("is partial_failed with successes and definitive failures", () => {
    expect(computeFeatureStatus([sent(), deadFailed()])).toBe("partial_failed");
  });

  it("is failed when nothing could be delivered", () => {
    expect(computeFeatureStatus([deadFailed(), deadFailed()])).toBe("failed");
  });
});

describe("computeReleaseStatus", () => {
  it("aggregates feature statuses", () => {
    expect(computeReleaseStatus([])).toBe("completed");
    expect(computeReleaseStatus(["completed", "processing"])).toBe("processing");
    expect(computeReleaseStatus(["completed", "completed"])).toBe("completed");
    expect(computeReleaseStatus(["completed", "failed"])).toBe("partial_failed");
    expect(computeReleaseStatus(["partial_failed", "completed"])).toBe("partial_failed");
    expect(computeReleaseStatus(["failed", "failed"])).toBe("failed");
  });
});

describe("updateReleaseStatuses", () => {
  it("persists derived statuses and ignores skipped features", async () => {
    const features: Array<{ id: string; status: FeatureStatus }> = [
      { id: "f1", status: "processing" },
      { id: "f2", status: "processing" },
      { id: "f3", status: "skipped" },
    ];
    const featureUpdates: Array<[string, FeatureStatus]> = [];
    let releaseStatus = "";
    const askedFor: string[][] = [];

    const source: ReleaseStatusSource = {
      getFeatures: async () => features,
      getDeliveryStates: async (ids) => {
        askedFor.push(ids);
        return new Map([
          ["f1", [sent(), skipped()]],
          ["f2", [sent(), deadFailed()]],
        ]);
      },
      updateFeatureStatus: async (id, status) => void featureUpdates.push([id, status]),
      updateReleaseStatus: async (_id, status) => void (releaseStatus = status),
    };

    const result = await updateReleaseStatuses("rel-1", source);

    expect(askedFor[0]).toEqual(["f1", "f2"]);
    expect(featureUpdates).toEqual([
      ["f1", "completed"],
      ["f2", "partial_failed"],
    ]);
    expect(releaseStatus).toBe("partial_failed");
    expect(result.releaseStatus).toBe("partial_failed");
  });

  it("keeps the release processing while deliveries remain", async () => {
    let releaseStatus = "";
    const source: ReleaseStatusSource = {
      getFeatures: async () => [{ id: "f1", status: "processing" }],
      getDeliveryStates: async () => new Map([["f1", [pending(), sent()]]]),
      updateFeatureStatus: async () => {},
      updateReleaseStatus: async (_id, status) => void (releaseStatus = status),
    };
    await updateReleaseStatuses("rel-1", source);
    expect(releaseStatus).toBe("processing");
  });
});
