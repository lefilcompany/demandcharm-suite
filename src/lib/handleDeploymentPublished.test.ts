import { describe, it, expect } from "vitest";
import {
  handleDeploymentPublished,
  type EventProcessingSource,
  type FeatureRow,
  type PlatformEventRow,
} from "../../supabase/functions/_shared/handleDeploymentPublished";
import type { DeliveryDataSource } from "../../supabase/functions/_shared/createFeatureDeliveries";

const RELEASE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

const event: PlatformEventRow = {
  id: "evt-1",
  event_type: "deployment.published",
  aggregate_type: "platform_release",
  aggregate_id: RELEASE_ID,
  payload: { releaseKey: "rel-2026-08-18" },
  attempts: 1,
};

function feature(id: string, key: string): FeatureRow {
  return {
    id,
    release_id: RELEASE_ID,
    announcement_key: key,
    audience_scope: "global",
    global_roles: null,
    team_roles: null,
    board_roles: null,
    team_id: null,
    board_id: null,
    priority: "normal",
    email_enabled: true,
    inapp_enabled: true,
    status: "pending",
  };
}

function makeDeliverySource(): DeliveryDataSource & { upserted: unknown[] } {
  const upserted: unknown[] = [];
  return {
    upserted,
    listGlobalUserIds: async () => [U1, U2],
    listTeamUserIds: async () => [U1],
    listBoardUserIds: async () => [U1],
    getNotificationPreferences: async () => new Map(),
    upsertDeliveries: async (rows) => void upserted.push(...rows),
  } as unknown as DeliveryDataSource & { upserted: unknown[] };
}

function makeSource(features: FeatureRow[], existing: Set<string> = new Set()) {
  const statuses: Array<[string, string]> = [];
  let releaseProcessing = false;
  const deliverySource = makeDeliverySource();

  const source: EventProcessingSource = {
    getReleaseForEvent: async () => ({
      id: RELEASE_ID,
      release_key: "rel-2026-08-18",
      status: "detected",
    }),
    markReleaseProcessing: async () => void (releaseProcessing = true),
    getPendingFeatures: async () => features,
    hasExistingDeliveries: async (key) => existing.has(key),
    setFeatureStatus: async (id, status) => void statuses.push([id, status]),
    deliverySource,
  };

  return { source, statuses, deliverySource, isProcessing: () => releaseProcessing };
}

describe("handleDeploymentPublished", () => {
  it("moves the release to processing and creates jobs per feature", async () => {
    const s = makeSource([feature("f1", "k1")]);
    const result = await handleDeploymentPublished(event, s.source);

    expect(s.isProcessing()).toBe(true);
    expect(s.statuses).toEqual([["f1", "processing"]]);
    expect(result.releaseId).toBe(RELEASE_ID);
    expect(result.jobsCreated).toBeGreaterThan(0);
    expect(result.failedFeatures).toBe(0);
    expect(s.deliverySource.upserted.length).toBeGreaterThan(0);
  });

  it("skips announcement keys already materialized", async () => {
    const s = makeSource([feature("f1", "k1")], new Set(["k1"]));
    const result = await handleDeploymentPublished(event, s.source);

    expect(s.statuses).toEqual([["f1", "skipped"]]);
    expect(result.features[0].status).toBe("skipped");
    expect(s.deliverySource.upserted).toHaveLength(0);
  });

  it("isolates a failing feature from the others", async () => {
    const s = makeSource([feature("f1", "k1"), feature("f2", "k2")]);
    s.source.deliverySource.upsertDeliveries = async (rows) => {
      if (rows[0]?.release_feature_id === "f1") throw new Error("db down");
    };

    const result = await handleDeploymentPublished(event, s.source);

    expect(result.failedFeatures).toBe(1);
    expect(result.features.map((f) => f.status)).toEqual(["failed", "processing"]);
    expect(s.statuses).toContainEqual(["f1", "failed"]);
  });

  it("throws when the release is missing", async () => {
    const s = makeSource([]);
    s.source.getReleaseForEvent = async () => null;
    await expect(handleDeploymentPublished(event, s.source)).rejects.toThrow(/release not found/);
  });
});
