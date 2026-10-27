// Single source of the financial formulas used on every finance screen.
// R gross, T taxes, E team cost, D direct expenses, F/O/A shared-cost allocations.

export type FinanceStatus = "rentavel" | "atencao" | "prejuizo" | "sem_dados";

export interface FinanceInputs {
  gross: number;
  tax: number;
  teamCost: number;
  directExpenses: number;
  fixedAlloc?: number;
  operationalAlloc?: number;
  adminAlloc?: number;
  marginTarget: number; // 0..1
}

export interface FinanceResult {
  gross: number;
  tax: number;
  netRevenue: number;
  contributionMargin: number;
  totalCost: number;
  result: number;
  /** null when gross is zero (margin unavailable) */
  margin: number | null;
  /** margin - target, in percentage points; null when margin unavailable */
  deviationPp: number | null;
  status: FinanceStatus;
}

export const DEFAULT_TAX_RATE = 0.21;
export const DEFAULT_MARGIN_TARGET = 0.4;

export const taxFor = (taxableGross: number, rate: number) => taxableGross * rate;

export function computeFinance(i: FinanceInputs): FinanceResult {
  const F = i.fixedAlloc ?? 0, O = i.operationalAlloc ?? 0, A = i.adminAlloc ?? 0;
  const netRevenue = i.gross - i.tax;
  const contributionMargin = netRevenue - i.teamCost - i.directExpenses;
  const totalCost = i.teamCost + i.directExpenses + F + O + A;
  const result = i.gross - i.tax - totalCost;
  const margin = i.gross > 0 ? result / i.gross : null;
  const deviationPp = margin === null ? null : (margin - i.marginTarget) * 100;
  let status: FinanceStatus;
  if (i.gross <= 0 && totalCost <= 0) status = "sem_dados";
  else if (result < 0) status = "prejuizo";
  else if (margin === null) status = "sem_dados";
  else status = margin >= i.marginTarget ? "rentavel" : "atencao";
  return { gross: i.gross, tax: i.tax, netRevenue, contributionMargin, totalCost, result, margin, deviationPp, status };
}

/** cost per hour of a collaborator for one month */
export function costPerHour(monthlyCost: number, productiveHours: number): number | null {
  return productiveHours > 0 ? monthlyCost / productiveHours : null;
}

/** P = C / (1 - t - r - m); null when the denominator is not positive */
export function minimumPrice(fixedCosts: number, taxRate: number, variableRate: number, margin: number): number | null {
  const d = 1 - taxRate - variableRate - margin;
  return d > 0 ? fixedCosts / d : null;
}

export const STATUS_LABEL: Record<FinanceStatus, string> = {
  rentavel: "Rentável",
  atencao: "Atenção",
  prejuizo: "Prejuízo",
  sem_dados: "Sem dados suficientes",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (v: number) => brl.format(v);
export const formatPct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const formatPp = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
