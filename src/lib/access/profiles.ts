export type MemberKind = "internal" | "client_external" | "contractor";

export const MEMBER_KIND_LABEL: Record<MemberKind, string> = {
  internal: "Interno",
  client_external: "Externo (cliente)",
  contractor: "Prestador",
};

export type ModulePermission =
  | "finance.view_team" | "finance.view_board" | "finance.view_project" | "finance.view_cost_details"
  | "finance.view_employee_costs" | "finance.manage_revenue" | "finance.manage_expenses" | "finance.manage_allocations"
  | "finance.manage_settings" | "finance.export" | "finance.close_period"
  | "projects.view" | "projects.edit" | "reports.view";

export const MODULES: { key: string; title: string; items: { p: ModulePermission; label: string }[] }[] = [
  { key: "finance", title: "Finanças", items: [
    { p: "finance.view_team", label: "Ver números da equipe" },
    { p: "finance.view_board", label: "Ver números por quadro" },
    { p: "finance.view_project", label: "Ver números por projeto" },
    { p: "finance.view_cost_details", label: "Ver composição dos custos" },
    { p: "finance.view_employee_costs", label: "Ver custo por pessoa" },
    { p: "finance.manage_revenue", label: "Lançar faturamento" },
    { p: "finance.manage_expenses", label: "Lançar despesas" },
    { p: "finance.manage_allocations", label: "Gerenciar rateios" },
    { p: "finance.manage_settings", label: "Configurações financeiras" },
    { p: "finance.export", label: "Exportar" },
    { p: "finance.close_period", label: "Fechar mês" },
  ] },
  { key: "projects", title: "Projetos", items: [
    { p: "projects.view", label: "Ver projetos" },
    { p: "projects.edit", label: "Editar projetos" },
  ] },
  { key: "reports", title: "Relatórios", items: [{ p: "reports.view", label: "Ver relatórios" }] },
];

export interface AccessProfile {
  id: string; team_id: string | null; system_key: string | null; name: string;
  description: string | null; permissions: string[]; is_system: boolean;
}

export const hasFinance = (perms: string[]) => perms.some((p) => p.startsWith("finance."));

/** Members who may never hold a profile that includes finance permissions. */
export function financeBlocked(teamRole: string, kind: MemberKind): string | null {
  if (teamRole === "requester") return "Solicitantes não podem ver o financeiro.";
  if (kind === "client_external") return "Externos do cliente não podem ver o financeiro.";
  return null;
}

/** Profile whose permission set equals `perms` exactly (system profiles first). */
export function matchProfile(perms: string[], profiles: AccessProfile[]): AccessProfile | null {
  const set = new Set(perms);
  const sorted = [...profiles].sort((a, b) => Number(b.is_system) - Number(a.is_system));
  return sorted.find((p) => p.permissions.length === set.size && p.permissions.every((x) => set.has(x))) ?? null;
}
