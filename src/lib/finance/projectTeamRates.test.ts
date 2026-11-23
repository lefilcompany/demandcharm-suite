import { describe, expect, it } from "vitest";
import { projectResult, type ProjectMonth } from "./projectRollup";

// The team's general values (NF tax rate, margin target) are what every project must use:
// the project screen no longer lets you set them per project.
const m = (p: Partial<ProjectMonth>): ProjectMonth => ({
  project_id: "p", competence: "2026-10-01", period_status: "open", board_ids: [], tax_rate: 0.15, variable_rate: 0, margin_target: 0.4,
  gross: 0, tax: 0, variable_costs: 0, direct_expenses: 0, alloc_fixed: 0, alloc_operational: 0, alloc_admin: 0,
  team_cost: 0, hours: 0, hours_without_cost: 0, people_without_cost: 0, ...p,
});

describe("team-wide rates applied to a project", () => {
  it("taxes the project's revenue with the team's NF rate", () => {
    const r = projectResult([m({ gross: 10000, tax: 1500, team_cost: 3000 })]);
    expect(r.netRevenue).toBe(5500);
    expect(r.margin).toBe(0.8333);
  });

  it("judges the project against the team's margin target", () => {
    const below = projectResult([m({ gross: 10000, tax: 1500, team_cost: 7000 })]);
    expect(below.margin).toBe(0.5333);
    expect(below.status).not.toBe("prejuizo");
    const loss = projectResult([m({ gross: 10000, tax: 1500, team_cost: 9000 })]);
    expect(loss.status).toBe("prejuizo");
  });

  it("a project with no revenue launched has no margin at all", () => {
    expect(projectResult([m({ team_cost: 2000 })]).margin).toBeNull();
  });
});
