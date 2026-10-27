import { describe, it, expect } from "vitest";
import { computeFinance, costPerHour, minimumPrice, taxFor } from "./engine";

describe("finance engine", () => {
  it("applies 21% tax on gross", () => {
    expect(taxFor(10000, 0.21)).toBeCloseTo(2100);
  });

  it("computes result and margin from the documented formulas", () => {
    const r = computeFinance({ gross: 10000, tax: 2100, teamCost: 3000, directExpenses: 500, fixedAlloc: 200, operationalAlloc: 100, adminAlloc: 100, marginTarget: 0.4 });
    expect(r.netRevenue).toBe(7900);
    expect(r.contributionMargin).toBe(4400);
    expect(r.totalCost).toBe(3900);
    expect(r.result).toBe(4000);
    expect(r.margin).toBeCloseTo(0.4);
    expect(r.status).toBe("rentavel");
  });

  it("flags margin below the 40% target as atenção with deviation in p.p.", () => {
    const r = computeFinance({ gross: 10000, tax: 2100, teamCost: 5000, directExpenses: 0, marginTarget: 0.4 });
    expect(r.margin).toBeCloseTo(0.29);
    expect(r.deviationPp).toBeCloseTo(-11);
    expect(r.status).toBe("atencao");
  });

  it("does not divide by zero when gross is zero", () => {
    const r = computeFinance({ gross: 0, tax: 0, teamCost: 1000, directExpenses: 0, marginTarget: 0.4 });
    expect(r.margin).toBeNull();
    expect(r.result).toBe(-1000);
    expect(r.status).toBe("prejuizo");
  });

  it("returns sem dados when there is nothing", () => {
    expect(computeFinance({ gross: 0, tax: 0, teamCost: 0, directExpenses: 0, marginTarget: 0.4 }).status).toBe("sem_dados");
  });

  it("negative result is prejuízo", () => {
    expect(computeFinance({ gross: 1000, tax: 210, teamCost: 900, directExpenses: 0, marginTarget: 0.4 }).status).toBe("prejuizo");
  });

  it("cost per hour and minimum price", () => {
    expect(costPerHour(7000, 140)).toBe(50);
    expect(costPerHour(7000, 0)).toBeNull();
    expect(minimumPrice(3900, 0.21, 0, 0.4)).toBeCloseTo(10000);
    expect(minimumPrice(1000, 0.5, 0.2, 0.4)).toBeNull();
  });
});
