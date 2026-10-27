import { describe, expect, it } from "vitest";
import { simulatePricing, validScenario, toggleComparison, scenarioCsv, type Scenario } from "./simulator";

const input = { gross: 10000, tax_rate: 0.21, variable_rate: 0, margin_target: 0.4, team_cost: 3000, planned_hours: 60, direct_expenses: 500, shared_costs: 400 };

describe("pricing simulator", () => {
  it("uses the initial demonstrative 21% tax", () => { expect(simulatePricing(input).tax).toBe(2100); });
  it("reaches the 40% margin target at a minimum gross price of 10000", () => {
    const r = simulatePricing(input);
    expect(r.minimum).toBeCloseTo(10000);
    expect(r.margin).toBeCloseTo(0.4);
    expect(r.result).toBe(4000);
  });
  it("counts revenue-variable costs exactly once", () => {
    const r = simulatePricing({ ...input, variable_rate: 0.1 });
    expect(r.variableCost).toBe(1000);
    expect(r.totalCost).toBe(4900);
    expect(r.minimum).toBeCloseTo(3900 / 0.29);
    expect(r.result).toBe(3000);
  });
  it("leaves margin unavailable for zero revenue", () => {
    expect(simulatePricing({ ...input, gross: 0 }).margin).toBeNull();
    expect(simulatePricing({ ...input, gross: 0 }).result).toBe(-3900);
  });
  it.each([0.6, 0.7])("leaves minimum unavailable when denominator is zero or negative (%s)", (tax_rate) => {
    expect(simulatePricing({ ...input, tax_rate }).minimum).toBeNull();
  });
  it("calculates saved assumptions without changing the saved values", () => {
    const saved = Object.freeze({ ...input });
    simulatePricing(saved);
    expect(saved.team_cost).toBe(3000);
    expect(simulatePricing(saved).minimum).toBeCloseTo(10000);
  });
  it("limits comparison to three scenarios", () => {
    expect(toggleComparison(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(toggleComparison(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(toggleComparison(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });
  it("rejects negative, nonfinite or out-of-range inputs", () => {
    expect(validScenario(input)).toBe(true);
    expect(validScenario({ ...input, team_cost: -1 })).toBe(false);
    expect(validScenario({ ...input, gross: NaN })).toBe(false);
    expect(validScenario({ ...input, tax_rate: 1.1 })).toBe(false);
  });
  it("exports numerical assumptions without enabling spreadsheet formulas", () => {
    const s: Scenario = { ...input, id: "a", team_id: "t", board_id: "b", name: "=1+1", client_label: "Cliente", competence: "2026-10-01", created_by: "u", created_at: "", updated_at: "" };
    const csv = scenarioCsv([{ ...s, board_name: "Projeto" }]);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain("10000,00");
  });
});