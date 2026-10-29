import { describe, it, expect } from "vitest";
import { resolveAttribution, type BoardLink } from "./attribution";

const link = (p: string, b: string, from = "2026-01-01", to: string | null = null, on = true): BoardLink => ({ projectId: p, boardId: b, validFrom: from, validTo: to, financeEnabled: on });

describe("resolveAttribution", () => {
  it("assigns automatically when the board is in exactly one active project", () => {
    expect(resolveAttribution([link("P1", "B1")], "B1", "2026-11-15")).toEqual({ status: "auto", projectId: "P1", reason: null });
  });
  it("is pending when the board is in two projects", () => {
    expect(resolveAttribution([link("P1", "B1"), link("P2", "B1")], "B1", "2026-11-01").reason).toBe("MULTIPLE_PROJECTS");
  });
  it("is pending when the board has no project", () => {
    expect(resolveAttribution([link("P1", "B2")], "B1", "2026-11-01").reason).toBe("NO_PROJECT");
  });
  it("ignores links that ended before the month or projects without finance", () => {
    expect(resolveAttribution([link("P1", "B1", "2026-01-01", "2026-10-31"), link("P2", "B1", "2026-01-01", null, false)], "B1", "2026-11-01").status).toBe("pending");
  });
});
