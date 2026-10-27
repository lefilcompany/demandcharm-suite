import { describe, expect, it } from "vitest";
import { applyAdjustments, canClose, monthEnded, normalizeChecklist } from "./closing";

describe("fechamento mensal", () => {
  it("um item bloqueante com ocorrência impede fechar", () => {
    const items = normalizeChecklist([{ code: "hours_without_cost", severity: "block", count: 2, amount: 10 }, { code: "boards_without_revenue", severity: "warn", count: 0 }]);
    expect(canClose(items)).toBe(false);
  });
  it("só avisos permitem fechar", () => {
    const items = normalizeChecklist([{ code: "hours_without_cost", severity: "block", count: 0 }, { code: "boards_without_revenue", severity: "warn", count: 3 }]);
    expect(canClose(items)).toBe(true);
  });
  it("diferença de centavos nos totais bloqueia", () => {
    expect(canClose(normalizeChecklist([{ code: "totals_mismatch", severity: "block", count: 1, amount: 0.02 }]))).toBe(false);
  });
  it("mês corrente não pode ser fechado", () => {
    const today = new Date("2026-10-27T12:00:00Z");
    expect(monthEnded("2026-10", today)).toBe(false);
    expect(monthEnded("2026-09", today)).toBe(true);
  });
  it("ajuste soma ao valor fechado sem alterar a fotografia", () => {
    const snap = [{ board_id: "a", gross: 1000, tax: 210, direct_expenses: 50, allocated_expenses: 0, team_cost: 300 }];
    const out = applyAdjustments(snap, [{ board_id: "a", target: "gross", amount: -100.01 }, { board_id: "b", target: "gross", amount: 999 }]);
    expect(out[0].gross).toBe(899.99);
    expect(snap[0].gross).toBe(1000);
  });
});
