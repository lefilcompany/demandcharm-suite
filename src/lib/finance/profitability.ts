// Project profitability table: per-project and team totals, from projectResult outputs.
export interface ProfitInput { id: string; name: string; gross: number; netRevenue: number; totalCost: number; hours: number; result: number; hoursWithoutCost: number }
export interface ProfitRow extends ProfitInput {
  margin: number | null;        // resultado ÷ faturamento bruto
  roi: number | null;           // resultado ÷ custo total (rentabilidade sobre o custo)
  resultPerHour: number | null; // resultado ÷ horas apontadas
  costShare: number | null;     // participação no custo da equipe
  complete: boolean;            // receita, custo, horas e margem calculados
}
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const c = (v: number) => Math.round(v * 100) / 100;

export function profitability(items: ProfitInput[]) {
  const sum = (k: keyof ProfitInput) => c(items.reduce((a, i) => a + Number(i[k]), 0));
  const totalCost = sum("totalCost");
  const rows: ProfitRow[] = items.map((i) => ({
    ...i,
    margin: ratio(i.result, i.gross),
    roi: ratio(i.result, i.totalCost),
    resultPerHour: ratio(i.result, i.hours),
    costShare: ratio(i.totalCost, totalCost),
    complete: i.gross > 0 && i.totalCost > 0 && i.hours > 0 && i.hoursWithoutCost === 0,
  }));
  const t = { gross: sum("gross"), netRevenue: sum("netRevenue"), totalCost, hours: sum("hours"), result: sum("result"), hoursWithoutCost: sum("hoursWithoutCost") };
  const total = { ...t, margin: ratio(t.result, t.gross), roi: ratio(t.result, t.totalCost), resultPerHour: ratio(t.result, t.hours) };
  const coverage = items.length ? rows.filter((r) => r.complete).length / items.length : null;
  return { rows, total, coverage, completeCount: rows.filter((r) => r.complete).length };
}
