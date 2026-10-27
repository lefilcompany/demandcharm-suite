import { computeFinance, minimumPrice, type FinanceResult } from "./engine";

export interface ScenarioInputs {
  gross: number;
  tax_rate: number;
  variable_rate: number;
  margin_target: number;
  team_cost: number;
  planned_hours: number;
  direct_expenses: number;
  shared_costs: number;
}

export interface Scenario extends ScenarioInputs {
  id: string;
  team_id: string;
  board_id: string;
  name: string;
  client_label: string;
  competence: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const MAX_COMPARISON = 3;

export function simulatePricing(i: ScenarioInputs): FinanceResult & { variableCost: number; minimum: number | null; fixedCost: number } {
  const variableCost = i.gross * i.variable_rate;
  const fixedCost = i.team_cost + i.direct_expenses + i.shared_costs;
  return {
    ...computeFinance({ gross: i.gross, tax: i.gross * i.tax_rate, teamCost: i.team_cost,
      directExpenses: i.direct_expenses + variableCost, operationalAlloc: i.shared_costs, marginTarget: i.margin_target }),
    variableCost, fixedCost,
    minimum: minimumPrice(fixedCost, i.tax_rate, i.variable_rate, i.margin_target),
  };
}

export function validScenario(i: ScenarioInputs): boolean {
  return [i.gross, i.team_cost, i.direct_expenses, i.shared_costs].every((v) => Number.isFinite(v) && v >= 0 && v < 1e12)
    && Number.isFinite(i.planned_hours) && i.planned_hours >= 0 && i.planned_hours < 1e9
    && [i.tax_rate, i.variable_rate, i.margin_target].every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
}

export function toggleComparison(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((v) => v !== id) : ids.length < MAX_COMPARISON ? [...ids, id] : ids;
}

// User-provided spreadsheet cells must not be interpreted as formulas.
export function scenarioCsv(scenarios: (Scenario & { board_name?: string })[]): string {
  const cell = (v: string | number) => typeof v === "number" ? v.toFixed(2).replace(".", ",")
    : `"${(/^[=+@\-\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
  const head = ["Cenário", "Cliente", "Quadro", "Competência", "Receita estimada", "Impostos %", "Variáveis %", "Meta %", "Horas", "Equipe", "Diretas", "Compartilhados", "Receita líquida", "Custo total", "Resultado", "Margem %", "Preço mínimo"];
  return "\ufeff" + [head.map(cell).join(";"), ...scenarios.map((s) => {
    const r = simulatePricing(s);
    return [s.name, s.client_label, s.board_name ?? "", s.competence.substring(0, 7), s.gross, s.tax_rate * 100,
      s.variable_rate * 100, s.margin_target * 100, s.planned_hours, s.team_cost, s.direct_expenses, s.shared_costs,
      r.netRevenue, r.totalCost, r.result, r.margin === null ? "" : r.margin * 100, r.minimum ?? ""].map(cell).join(";");
  })].join("\n");
}