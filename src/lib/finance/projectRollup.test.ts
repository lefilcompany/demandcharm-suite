import { describe, expect, it } from "vitest";
import { projectResult, settingsFor, sumMonths, type ProjectMonth } from "./projectRollup";

const m = (p: Partial<ProjectMonth>): ProjectMonth => ({
  project_id: "p", competence: "2026-10-01", period_status: "open", board_ids: [], tax_rate: 0.21, variable_rate: 0, margin_target: 0.4,
  gross: 0, tax: 0, variable_costs: 0, direct_expenses: 0, alloc_fixed: 0, alloc_operational: 0, alloc_admin: 0,
  team_cost: 0, hours: 0, hours_without_cost: 0, people_without_cost: 0, ...p,
});

describe("project rollup", () => {
  it("sums cents exactly across months", () => {
    expect(sumMonths([m({ gross: 0.1 }), m({ gross: 0.2 })]).gross).toBe(0.3);
    expect(sumMonths([m({ alloc_fixed: 33.33 }), m({ alloc_fixed: 33.33 }), m({ alloc_fixed: 33.34 })]).fixed).toBe(100);
  });

  it("computes result and margin with variable costs as expense", () => {
    const r = projectResult([m({ gross: 10000, tax: 2100, variable_costs: 500, direct_expenses: 400, team_cost: 3000, alloc_fixed: 1000 })]);
    expect(r.result).toBe(3000);
    expect(r.margin).toBe(0.3);
    expect(r.status).toBe("atencao");
  });

  it("no revenue gives no margin", () => {
    expect(projectResult([m({ team_cost: 500 })]).margin).toBeNull();
  });

  it("picks the settings in effect for the month", () => {
    const rows = [{ valid_from: "2026-01-01", v: 1 }, { valid_from: "2026-09-01", v: 2 }];
    expect(settingsFor(rows, "2026-08")?.v).toBe(1);
    expect(settingsFor(rows, "2026-10")?.v).toBe(2);
    expect(settingsFor(rows, "2025-12")).toBeNull();
  });
});
