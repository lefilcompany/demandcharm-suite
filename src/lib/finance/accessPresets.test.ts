import { describe, it, expect } from "vitest";
import { detectPreset, diffPermissions, PRESETS } from "./accessPresets";

describe("finance access presets", () => {
  it("no permissions is 'Sem acesso'", () => expect(detectPreset([])).toBe("none"));
  it("only Gestão includes closing the month and per-person cost", () => {
    expect(PRESETS.manager.perms).toContain("finance.close_period");
    expect(PRESETS.analyst.perms).not.toContain("finance.view_employee_costs");
    expect(PRESETS.reader.perms).not.toContain("finance.export");
  });
  it("a mix that matches no preset is custom", () => expect(detectPreset(["finance.view_team", "finance.close_period"])).toBeNull());
  it("diff grants missing and revokes extra", () => {
    expect(diffPermissions(["finance.view_team", "finance.export"], ["finance.view_team", "finance.view_board"]))
      .toEqual({ grant: ["finance.view_board"], revoke: ["finance.export"] });
  });
});
