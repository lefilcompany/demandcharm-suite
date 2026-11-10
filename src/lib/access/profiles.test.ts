import { describe, it, expect } from "vitest";
import { financeBlocked, matchProfile, hasFinance, type AccessProfile } from "./profiles";

const p = (id: string, perms: string[], is_system = true): AccessProfile =>
  ({ id, team_id: null, system_key: id, name: id, description: null, permissions: perms, is_system });

describe("access profiles", () => {
  it("blocks finance for requesters and client externals", () => {
    expect(financeBlocked("requester", "internal")).not.toBeNull();
    expect(financeBlocked("member", "client_external")).not.toBeNull();
    expect(financeBlocked("member", "contractor")).toBeNull();
  });
  it("matches an exact permission set, preferring system profiles", () => {
    const list = [p("custom", ["projects.view"], false), p("pm", ["projects.view"])];
    expect(matchProfile(["projects.view"], list)?.id).toBe("pm");
    expect(matchProfile(["projects.view", "reports.view"], list)).toBeNull();
  });
  it("detects finance permissions", () => {
    expect(hasFinance(["projects.view"])).toBe(false);
    expect(hasFinance(["finance.export"])).toBe(true);
  });
});

import { canUseModule, matchesKindFilter } from "./profiles";
describe("module access", () => {
  it("owner/admin always pass, others need the permission", () => {
    expect(canUseModule({ full: true, permissions: [] }, "projects.view")).toBe(true);
    expect(canUseModule({ full: false, permissions: [] }, "reports.view")).toBe(false);
    expect(canUseModule({ full: false, permissions: ["reports.view"] }, "reports.view")).toBe(true);
    expect(canUseModule(null, "projects.view")).toBe(false);
  });
  it("filters demands by internal/external assignees", () => {
    const k = new Map([["a", "internal"], ["b", "contractor"]] as const) as any;
    expect(matchesKindFilter(["a", "b"], k, "external")).toBe(true);
    expect(matchesKindFilter(["a"], k, "external")).toBe(false);
    expect(matchesKindFilter(["a"], k, "internal")).toBe(true);
    expect(matchesKindFilter(["a", "b"], k, "internal")).toBe(false);
  });
});
