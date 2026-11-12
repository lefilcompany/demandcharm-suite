// Minimum contract price from the team's standard values. Pure, no I/O.
export interface PricingDefaults {
  hourlyCost: number;   // R$ per man-hour
  taxRate: number;      // 0..1
  variableRate: number; // 0..1
  allocationPct: number; // 0..1, fixed share of revenue for shared expenses
  marginTarget: number; // 0..1
  maxDiscount: number;  // 0..1
}
export interface MinimumPriceResult {
  ok: boolean;
  /** sum of every percentage taken out of revenue */
  takeRate: number;
  laborCost: number;
  /** price that covers cost + taxes + allocation + variable + target margin */
  minimumPrice: number;
  /** list price so that the max discount still lands on the minimum price */
  listPrice: number;
}
const r2 = (v: number) => Math.round(v * 100) / 100;

export function minimumPrice(hours: number, d: PricingDefaults): MinimumPriceResult {
  const laborCost = r2(Math.max(0, hours) * Math.max(0, d.hourlyCost));
  const takeRate = d.taxRate + d.variableRate + d.allocationPct + d.marginTarget;
  if (takeRate >= 1) return { ok: false, takeRate, laborCost, minimumPrice: 0, listPrice: 0 };
  const min = r2(laborCost / (1 - takeRate));
  const list = d.maxDiscount > 0 && d.maxDiscount < 1 ? r2(min / (1 - d.maxDiscount)) : min;
  return { ok: true, takeRate, laborCost, minimumPrice: min, listPrice: list };
}
