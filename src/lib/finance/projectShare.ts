/** Mirror of `_finance_team_cost_share`: each team cost is split equally across the projects active in the month. */
export type TeamCostType = "fixa" | "operacional" | "administrativa";
export const TEAM_COST_TYPES: TeamCostType[] = ["fixa", "operacional", "administrativa"];
export const TEAM_COST_LABEL: Record<TeamCostType, string> = { fixa: "Custo fixo", operacional: "Custo operacional", administrativa: "Custo administrativo" };
export const TEAM_COST_HINT: Record<TeamCostType, string> = {
  fixa: "Aluguel, internet, energia, contas fixas.",
  operacional: "Ferramentas, softwares e insumos da operação.",
  administrativa: "Contabilidade, jurídico, administrativo (sem imposto de NF).",
};

export function shareAmount(total: number, activeProjects: number): number {
  if (!activeProjects || activeProjects <= 0) return 0;
  return Math.round((total / activeProjects) * 100) / 100;
}

export function shareAll(costs: Record<TeamCostType, number>, activeProjects: number) {
  const parts = TEAM_COST_TYPES.map((t) => ({ type: t, total: costs[t] ?? 0, perProject: shareAmount(costs[t] ?? 0, activeProjects) }));
  return { parts, totalPerProject: Math.round(parts.reduce((s, p) => s + p.perProject, 0) * 100) / 100 };
}
