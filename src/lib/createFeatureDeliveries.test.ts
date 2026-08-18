import { describe, it, expect } from "vitest";
import {
  createFeatureDeliveries,
  planFeatureDeliveries,
  isChannelEnabledForProductUpdates,
  PREFERENCE_DISABLED_REASON,
  type DeliveryDataSource,
  type DeliveryRow,
  type ReleaseFeatureInput,
} from "../../supabase/functions/_shared/createFeatureDeliveries";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

const feature = (over: Partial<ReleaseFeatureInput> = {}): ReleaseFeatureInput => ({
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  announcement_key: "ann-1",
  audience_scope: "global",
  global_roles: ["admin"],
  priority: "high",
  email_enabled: true,
  inapp_enabled: true,
  ...over,
});

function source(userIds: string[], prefs: Record<string, Record<string, unknown>>) {
  const written: DeliveryRow[] = [];
  const ds: DeliveryDataSource = {
    listGlobalRoleUserIds: async () => userIds,
    listTeamMemberUserIds: async () => userIds,
    listBoardMemberUserIds: async () => userIds,
    filterExistingUserIds: async (ids) => ids,
    getNotificationPreferences: async (ids) =>
      new Map(ids.filter((id) => prefs[id]).map((id) => [id, prefs[id]])),
    upsertDeliveries: async (rows) => {
      written.push(...rows);
    },
  };
  return { ds, written };
}

describe("isChannelEnabledForProductUpdates", () => {
  it("defaults to enabled when preferences are missing", () => {
    expect(isChannelEnabledForProductUpdates(undefined, "email")).toBe(true);
    expect(isChannelEnabledForProductUpdates({}, "inapp")).toBe(true);
  });

  it("undefined productUpdates means enabled", () => {
    const prefs = { channels: { email: { enabled: true, types: {} } } };
    expect(isChannelEnabledForProductUpdates(prefs, "email")).toBe(true);
  });

  it("explicit false disables", () => {
    const prefs = { channels: { email: { enabled: true, types: { productUpdates: false } } } };
    expect(isChannelEnabledForProductUpdates(prefs, "email")).toBe(false);
  });

  it("channel master switch off disables", () => {
    const prefs = { channels: { inapp: { enabled: false, types: {} } } };
    expect(isChannelEnabledForProductUpdates(prefs, "inapp")).toBe(false);
  });

  it("legacy format respects emailNotifications", () => {
    expect(isChannelEnabledForProductUpdates({ emailNotifications: false }, "email")).toBe(false);
    expect(isChannelEnabledForProductUpdates({ emailNotifications: false }, "inapp")).toBe(true);
  });
});

describe("planFeatureDeliveries", () => {
  it("low priority only produces inapp", () => {
    const { rows, summary } = planFeatureDeliveries(feature({ priority: "low" }), [U1], new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe("inapp");
    expect(summary).toEqual({ audience: 1, emailPending: 0, inappPending: 1, skippedPreferences: 0 });
  });

  it("normal priority only mails when email_enabled is true", () => {
    const off = planFeatureDeliveries(feature({ priority: "normal", email_enabled: false }), [U1], new Map());
    expect(off.summary.emailPending).toBe(0);
    const on = planFeatureDeliveries(feature({ priority: "normal", email_enabled: true }), [U1], new Map());
    expect(on.summary.emailPending).toBe(1);
  });

  it("feature inapp_enabled=false removes inapp", () => {
    const { summary } = planFeatureDeliveries(feature({ inapp_enabled: false }), [U1], new Map());
    expect(summary.inappPending).toBe(0);
    expect(summary.emailPending).toBe(1);
  });

  it("critical still respects productUpdates opt-out", () => {
    const prefs = new Map([[U1, { channels: { email: { enabled: true, types: { productUpdates: false } } } }]]);
    const { rows, summary } = planFeatureDeliveries(feature({ priority: "critical" }), [U1], prefs);
    const email = rows.find((r) => r.channel === "email")!;
    expect(email.status).toBe("skipped");
    expect(email.last_error).toBe(PREFERENCE_DISABLED_REASON);
    expect(summary).toEqual({ audience: 1, emailPending: 0, inappPending: 1, skippedPreferences: 1 });
  });
});

describe("createFeatureDeliveries", () => {
  it("returns an empty summary when nobody has access", async () => {
    const { ds, written } = source([], {});
    const summary = await createFeatureDeliveries(feature(), ds);
    expect(summary).toEqual({ audience: 0, emailPending: 0, inappPending: 0, skippedPreferences: 0 });
    expect(written).toHaveLength(0);
  });

  it("plans both channels and reports the summary", async () => {
    const { ds, written } = source([U1, U2], {
      [U2]: { channels: { inapp: { enabled: true, types: { productUpdates: false } } } },
    });
    const summary = await createFeatureDeliveries(feature(), ds);
    expect(summary).toEqual({ audience: 2, emailPending: 2, inappPending: 1, skippedPreferences: 1 });
    expect(written).toHaveLength(4);
  });
});
