import { describe, expect, it } from "vitest";
import { canWrite, WRITE_TOOLS, titleSimilarity, selectSprintCandidates } from "../../../supabase/functions/board-agent/policies";
describe("assistant action rules", () => {
  it("requires approval for every suggested mutation", () => {
    expect([...WRITE_TOOLS]).toEqual(["create_demand", "update_demand", "create_follow_up", "bulk_update_demands", "apply_sprint_plan"]);
  });
  it("requesters cannot operate demands", () => { expect(canWrite("requester")).toBe(false); expect(canWrite(null)).toBe(false); });
  it("board agents and managers can operate", () => { for (const role of ["admin", "moderator", "executor"]) expect(canWrite(role)).toBe(true); });
  it("sprint planning respects effort and existing membership", () => {
    const result = selectSprintCandidates([
      { id: "a", effort_points: 5, priority: "alta", due_on: null },
      { id: "b", effort_points: 8, priority: "média", due_on: null },
      { id: "c", effort_points: 3, priority: "alta", due_on: null },
      { id: "d", effort_points: null, priority: "alta", due_on: null },
    ], new Set(["c"]), 10, "2026-10-30");
    expect(result.selected.map(r => r.id)).toEqual(["a"]);
    expect(result.planned_points).toBe(5); expect(result.missing_effort.map(r => r.id)).toEqual(["d"]);
  });
  it("flags similar titles without claiming identical demands", () => {
    expect(titleSimilarity("Criar relatório mensal", "Criar relatorio mensal")).toBe(1);
    expect(titleSimilarity("Criar relatório mensal", "Editar vídeo")).toBe(0);
  });
});