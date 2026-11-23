import { describe, it, expect } from "vitest";
import { splitContract, contractEnd } from "./revenueContract";

describe("splitContract", () => {
  it("months: total dividido pelos meses", () => {
    const r = splitContract(30000, "2026-11-01", 3, "months");
    expect(r).toEqual([
      { competence: "2026-11-01", amount: 10000 },
      { competence: "2026-12-01", amount: 10000 },
      { competence: "2027-01-01", amount: 10000 },
    ]);
  });
  it("years: total ÷ anos, cada ano em 12 meses", () => {
    const r = splitContract(360000, "2026-01-01", 3, "years");
    expect(r).toHaveLength(36);
    expect(r[0].amount).toBe(10000);
    expect(r.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(360000, 2);
  });
  it("days: proporcional aos dias de cada mês", () => {
    const r = splitContract(1500, "2026-11-25", 15, "days");
    expect(r).toEqual([
      { competence: "2026-11-01", amount: 600 },
      { competence: "2026-12-01", amount: 900 },
    ]);
  });
  it("centavos de arredondamento vão para o último mês", () => {
    const r = splitContract(100, "2026-01-01", 3, "months");
    expect(r.map((x) => x.amount)).toEqual([33.33, 33.33, 33.34]);
  });
  it("fim do contrato", () => {
    expect(contractEnd("2026-11-25", 15, "days")).toBe("2026-12-09");
    expect(contractEnd("2026-11-01", 2, "months")).toBe("2026-12-31");
  });
});
