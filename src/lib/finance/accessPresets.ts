import type { FinancePermission } from "@/hooks/useFinance";

export type AccessPreset = "none" | "reader" | "analyst" | "manager";

export const PERMISSION_GROUPS: { title: string; items: FinancePermission[] }[] = [
  { title: "Ver", items: ["finance.view_team", "finance.view_board", "finance.view_project", "finance.view_cost_details", "finance.view_employee_costs"] },
  { title: "Lançar", items: ["finance.manage_revenue", "finance.manage_expenses", "finance.manage_allocations"] },
  { title: "Administrar", items: ["finance.manage_settings", "finance.export", "finance.close_period"] },
];

const READER: FinancePermission[] = ["finance.view_team", "finance.view_board", "finance.view_project"];
const ANALYST: FinancePermission[] = [...READER, "finance.view_cost_details", "finance.export"];
const MANAGER: FinancePermission[] = PERMISSION_GROUPS.flatMap((g) => g.items);

export const PRESETS: Record<AccessPreset, { label: string; hint: string; perms: FinancePermission[] }> = {
  none: { label: "Sem acesso", hint: "Não vê nada do financeiro.", perms: [] },
  reader: { label: "Leitura", hint: "Vê resultados e margens dos projetos.", perms: READER },
  analyst: { label: "Análise", hint: "Leitura + composição dos custos e exportação.", perms: ANALYST },
  manager: { label: "Gestão", hint: "Tudo, inclusive custo por pessoa e fechar o mês.", perms: MANAGER },
};

/** Which preset matches exactly the given team-wide permissions; null = custom. */
export function detectPreset(perms: FinancePermission[]): AccessPreset | null {
  const set = new Set(perms);
  for (const key of Object.keys(PRESETS) as AccessPreset[]) {
    const p = PRESETS[key].perms;
    if (p.length === set.size && p.every((x) => set.has(x))) return key;
  }
  return null;
}

/** Grants and revokes needed to go from `current` to `target`. */
export function diffPermissions(current: FinancePermission[], target: FinancePermission[]) {
  const cur = new Set(current), tgt = new Set(target);
  return { grant: target.filter((p) => !cur.has(p)), revoke: current.filter((p) => !tgt.has(p)) };
}
