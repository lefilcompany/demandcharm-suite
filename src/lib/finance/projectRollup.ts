// Project x month rollup as returned by get_project_finance_overview; formulas come from engine.ts.
import { computeFinance, type FinanceResult } from "./engine";

export interface ProjectMonth {
  project_id: string;
  competence: string;
  period_status: string;
  board_ids: string[];
  tax_rate: number;
  variable_rate: number;
  margin_target: number;
  gross: number;
  tax: number;
  variable_costs: number;
  direct_expenses: number;
  alloc_fixed: number;
  alloc_operational: number;
  alloc_admin: number;
  team_cost: number;
  hours: number;
  hours_without_cost: number;
  people_without_cost: number;
  has_adjustments?: boolean;
  adjustments?: ProjectAdjustment[];
}

export interface ProjectAdjustment {
  id: string; board_id: string; board_name: string | null; target: string; amount: number;
  reason: string; author: string | null; created_at: string;
}

const cents = (v: number) => Math.round(v * 100) / 100;

/** Sum months (cent-exact) into one input set; target = latest month's target. */
export function sumMonths(months: ProjectMonth[]) {
  const s = (k: keyof ProjectMonth) => cents(months.reduce((a, m) => a + Math.round(Number(m[k]) * 100), 0) / 100);
  return {
    gross: s("gross"), tax: s("tax"), variable: s("variable_costs"), direct: s("direct_expenses"),
    fixed: s("alloc_fixed"), operational: s("alloc_operational"), admin: s("alloc_admin"),
    teamCost: s("team_cost"), hours: s("hours"), hoursWithoutCost: s("hours_without_cost"),
    marginTarget: months.length ? Number(months[months.length - 1].margin_target) : 0.4,
  };
}

/** Variable costs (% of revenue) are treated as direct expenses in the shared engine. */
export function projectResult(months: ProjectMonth[]): FinanceResult & { totals: ReturnType<typeof sumMonths> } {
  const t = sumMonths(months);
  const r = computeFinance({
    gross: t.gross, tax: t.tax, teamCost: t.teamCost, directExpenses: cents(t.direct + t.variable),
    fixedAlloc: t.fixed, operationalAlloc: t.operational, adminAlloc: t.admin, marginTarget: t.marginTarget,
  });
  return { ...r, totals: t };
}

/** Settings in effect for a month: the latest row whose valid_from <= month. */
export function settingsFor<T extends { valid_from: string }>(rows: T[], month: string): T | null {
  const m = `${month.substring(0, 7)}-01`;
  return [...rows].filter((r) => r.valid_from.substring(0, 10) <= m).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] ?? null;
}
