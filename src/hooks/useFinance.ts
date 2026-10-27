import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type FinancePermission =
  | "finance.view_team" | "finance.view_board" | "finance.view_project" | "finance.view_cost_details"
  | "finance.view_employee_costs" | "finance.manage_revenue" | "finance.manage_expenses"
  | "finance.manage_allocations" | "finance.manage_settings" | "finance.export";

export const PERMISSION_LABELS: Record<FinancePermission, string> = {
  "finance.view_team": "Ver números da equipe",
  "finance.view_board": "Ver números do quadro",
  "finance.view_project": "Ver detalhe do projeto",
  "finance.view_cost_details": "Ver composição dos custos",
  "finance.view_employee_costs": "Ver custo de cada pessoa",
  "finance.manage_revenue": "Lançar faturamento",
  "finance.manage_expenses": "Lançar despesas",
  "finance.manage_allocations": "Configurar rateios",
  "finance.manage_settings": "Configurar metas e alíquotas",
  "finance.export": "Exportar relatórios",
};

export interface FinanceAccess {
  is_global_admin: boolean;
  is_team_owner: boolean;
  team_permissions: FinancePermission[];
  board_permissions: { board_id: string; permission: FinancePermission }[];
}

export function useFinanceAccess(teamId: string | null) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["finance-access", teamId, user?.id],
    enabled: !!teamId && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_finance_access", { _team_id: teamId! });
      if (error) throw error;
      return (data as unknown as FinanceAccess) ?? null;
    },
  });
  const a = q.data;
  const can = (p: FinancePermission, boardId?: string) =>
    !!a && (a.is_global_admin || a.team_permissions.includes(p) ||
      (!!boardId && a.board_permissions.some((b) => b.board_id === boardId && b.permission === p)));
  const canAny = (p: FinancePermission) => can(p) || !!a?.board_permissions.some((b) => b.permission === p);
  const hasModule = !!a && (a.is_global_admin || a.team_permissions.length > 0 || a.board_permissions.length > 0);
  return { ...q, access: a, can, canAny, hasModule };
}

export interface OverviewRow {
  board_id: string; board_name: string; competence: string;
  gross: number; tax: number; direct_expenses: number; team_cost: number;
  hours_realized: number; hours_planned: number; hours_without_cost: number; margin_target: number;
}

export function useFinanceOverview(teamId: string | null, from: string, to: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-overview", teamId, user?.id, from, to],
    enabled: enabled && !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finance_overview", { _team_id: teamId!, _from: from, _to: to });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        gross: Number(r.gross), tax: Number(r.tax), direct_expenses: Number(r.direct_expenses), team_cost: Number(r.team_cost),
        hours_realized: Number(r.hours_realized), hours_planned: Number(r.hours_planned),
        hours_without_cost: Number(r.hours_without_cost), margin_target: Number(r.margin_target),
      })) as OverviewRow[];
    },
  });
}

export function useFinanceTable<T = any>(table: "finance_revenues" | "finance_expenses" | "finance_employee_costs" | "finance_permissions" | "finance_settings", teamId: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-table", table, teamId, user?.id],
    enabled: enabled && !!teamId && !!user,
    queryFn: async () => {
      let q = supabase.from(table).select("*").eq("team_id", teamId!);
      if (table === "finance_permissions") q = q.is("revoked_at", null);
      const { data, error } = await q.order(table === "finance_permissions" ? "granted_at" : table === "finance_settings" ? "updated_at" : "created_at", { ascending: false });
      if (error) throw error;
      return data as T[];
    },
  });
}

export function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["finance-table"] });
    qc.invalidateQueries({ queryKey: ["finance-overview"] });
    qc.invalidateQueries({ queryKey: ["finance-access"] });
  };
}

export function useFinanceMutation<V>(fn: (v: V) => Promise<unknown>) {
  const inv = useInvalidateFinance();
  return useMutation({ mutationFn: fn, onSuccess: inv });
}
