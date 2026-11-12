import { describe, it, expect } from "vitest";
import { minimumPrice } from "./pricing";

const d = { hourlyCost: 100, taxRate: 0.1, variableRate: 0.05, allocationPct: 0.08, marginTarget: 0.17, maxDiscount: 0 };

describe("minimumPrice", () => {
  it("covers labor plus every percentage taken from revenue", () => {
    const r = minimumPrice(60, d); // 6000 / (1 - 0.40)
    expect(r.ok).toBe(true);
    expect(r.laborCost).toBe(6000);
    expect(r.minimumPrice).toBe(10000);
  });
  it("list price leaves room for the max discount", () => {
    expect(minimumPrice(60, { ...d, maxDiscount: 0.2 }).listPrice).toBe(12500);
  });
  it("percentages at or above 100% have no possible price", () => {
    expect(minimumPrice(60, { ...d, marginTarget: 0.77 }).ok).toBe(false);
  });
});
