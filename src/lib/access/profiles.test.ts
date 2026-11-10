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
