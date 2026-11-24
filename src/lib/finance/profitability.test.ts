import { describe, it, expect } from "vitest";
import { profitability } from "./profitability";
const a = { id: "a", name: "A", gross: 10000, netRevenue: 8000, totalCost: 4000, hours: 40, result: 4000, hoursWithoutCost: 0 };
const b = { id: "b", name: "B", gross: 0, netRevenue: 0, totalCost: 2000, hours: 10, result: -2000, hoursWithoutCost: 0 };
describe("profitability", () => {
  it("margem = resultado ÷ faturamento; rentabilidade = resultado ÷ custo", () => {
    const r = profitability([a]).rows[0];
    expect(r.margin).toBe(0.4); expect(r.roi).toBe(1); expect(r.resultPerHour).toBe(100);
  });
  it("sem faturamento a margem fica indisponível e o projeto não conta como completo", () => {
    const r = profitability([a, b]);
    expect(r.rows[1].margin).toBeNull(); expect(r.coverage).toBe(0.5);
  });
  it("total da equipe é calculado sobre as somas", () => {
    const t = profitability([a, b]).total;
    expect(t.result).toBe(2000); expect(t.margin).toBe(0.2); expect(t.roi).toBeCloseTo(2000 / 6000);
  });
  it("horas sem custo deixam o projeto incompleto", () => {
    expect(profitability([{ ...a, hoursWithoutCost: 2 }]).coverage).toBe(0);
  });
});
