import { describe, it, expect } from "vitest";
import { rollupByPerformance, NO_PERFORMANCE } from "./performanceRollup";
import type { ProjectMonth } from "./projectRollup";

const m = (gross: number, team: number): ProjectMonth => ({ project_id: "x", competence: "2026-01-01", period_status: "open", board_ids: [], tax_rate: 0.1, variable_rate: 0, margin_target: 0.4,
  gross, tax: gross * 0.1, variable_costs: 0, direct_expenses: 0, alloc_fixed: 0, alloc_operational: 0, alloc_admin: 0, team_cost: team, hours: 10, hours_without_cost: 0, people_without_cost: 0 });
const perfs = [{ id: "p1", name: "Plataformas", color: "#f00" }, { id: "p2", name: "Conteúdo", color: "#0f0" }];

describe("rollupByPerformance", () => {
  const out = rollupByPerformance([
    { project_id: "a", name: "A", performance_id: "p1", active: true, months: [m(1000, 300)] },
    { project_id: "b", name: "B", performance_id: "p1", active: false, months: [m(500, 100)] },
    { project_id: "c", name: "C", performance_id: "p2", active: true, months: [m(200, 400)] },
    { project_id: "d", name: "D", performance_id: null, active: true, months: [m(100, 0)] },
  ], perfs);
  it("each project counts in one performance", () => {
    expect(out.reduce((a, g) => a + g.projectCount, 0)).toBe(4);
    const p1 = out.find((g) => g.id === "p1")!;
    expect(p1.projectCount).toBe(2); expect(p1.activeCount).toBe(1);
    expect(p1.r.gross).toBe(1500); expect(p1.r.totals.teamCost).toBe(400);
  });
  it("projects without performance go to their own group", () => {
    expect(out.find((g) => g.id === NO_PERFORMANCE)!.r.gross).toBe(100);
  });
  it("group totals add up to the team total", () => {
    expect(out.reduce((a, g) => a + g.r.gross, 0)).toBe(1800);
  });
});
