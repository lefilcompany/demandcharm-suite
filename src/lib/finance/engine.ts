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

/** Cor do resultado: vermelho no prejuízo, verde no lucro, neutro quando zero. */
export const resultTone = (v: number) => (v < 0 ? "text-destructive" : v > 0 ? "text-success" : "");

/**
 * Cores que a legenda de um gráfico de resultado deve mostrar: exatamente as que
 * aparecem nas barras, para a legenda nunca prometer uma cor que o gráfico não tem.
 */
export function resultLegendTones(values: number[]): { label: string; color: string }[] {
  const tones: { label: string; color: string }[] = [];
  if (values.some((v) => v < 0)) tones.push({ label: "Resultado (prejuízo)", color: "hsl(var(--destructive))" });
  if (values.some((v) => v > 0)) tones.push({ label: "Resultado (lucro)", color: "hsl(var(--success))" });
  if (!tones.length) tones.push({ label: "Resultado", color: "hsl(var(--muted-foreground))" });
  return tones;
}

export type MarginGoalTone = "muted" | "destructive" | "primary" | "success";

/** Margem de lucro frente à meta da equipe: preenchimento da barra, cor e frase em português. */
export function marginGoalState(margin: number | null, target: number): { tone: MarginGoalTone; progress: number; text: string } {
  if (margin === null)
    return { tone: "muted", progress: 0, text: "Sem faturamento no período, então a margem de lucro não pode ser calculada." };
  const pp = Math.round((margin - target) * 100);
  const progress = target > 0 ? Math.max(0, Math.min(1, margin / target)) : 1;
  if (margin < 0)
    return { tone: "destructive", progress: 0, text: `Prejuízo: os custos passaram o faturamento. Faltam ${-pp} p.p. para a meta de lucro.` };
  if (margin >= target)
    return { tone: "success", progress: 1, text: `Meta de lucro batida: ${pp} p.p. acima dos ${formatPct(target)} pedidos.` };
  return { tone: "primary", progress, text: `Faltam ${-pp} p.p. para a meta de lucro de ${formatPct(target)}.` };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (v: number) => brl.format(v);
export const formatPct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const formatPp = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
