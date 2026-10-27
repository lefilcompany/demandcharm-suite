import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type FinancePermission =
  | "finance.view_team" | "finance.view_board" | "finance.view_project" | "finance.view_cost_details"
  | "finance.view_employee_costs" | "finance.manage_revenue" | "finance.manage_expenses"
  | "finance.manage_allocations" | "finance.manage_settings" | "finance.export" | "finance.close_period";

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
  "finance.close_period": "Fechar mês",
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
  gross: number; tax: number; direct_expenses: number; allocated_expenses: number; team_cost: number;
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
        gross: Number(r.gross), tax: Number(r.tax), direct_expenses: Number(r.direct_expenses), allocated_expenses: Number(r.allocated_expenses ?? 0), team_cost: Number(r.team_cost),
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
    qc.invalidateQueries({ queryKey: ["finance-allocation"] });
    qc.invalidateQueries({ queryKey: ["finance-people"] });
    qc.invalidateQueries({ queryKey: ["finance-closing"] });
  };
}

export function useFinanceMutation<V>(fn: (v: V) => Promise<unknown>) {
  const inv = useInvalidateFinance();
  return useMutation({ mutationFn: fn, onSuccess: inv });
}

export interface AllocationRow {
  expense_id: string; description: string; expense_type: string; allocation_method: string; competence: string;
  total: number; board_id: string | null; board_name: string | null; amount: number; share: number | null;
}

export function useFinanceAllocation(teamId: string | null, from: string, to: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-allocation", teamId, user?.id, from, to],
    enabled: enabled && !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finance_allocation", { _team_id: teamId!, _from: from, _to: to });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ ...r, total: Number(r.total), amount: Number(r.amount), share: r.share == null ? null : Number(r.share) })) as AllocationRow[];
    },
  });
}

export interface PeopleRow {
  user_id: string | null; full_name: string | null; competence: string; monthly_cost: number | null; productive_hours: number | null;
  board_id: string | null; board_name: string | null; hours: number; cost: number | null;
}

export function useFinancePeople(teamId: string | null, from: string, to: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-people", teamId, user?.id, from, to],
    enabled: enabled && !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_finance_people", { _team_id: teamId!, _from: from, _to: to });
      if (error) throw error;
      const n = (v: any) => (v == null ? null : Number(v));
      return ((data ?? []) as any[]).map((r) => ({ ...r, monthly_cost: n(r.monthly_cost), productive_hours: n(r.productive_hours), hours: Number(r.hours ?? 0), cost: n(r.cost) })) as PeopleRow[];
    },
  });
}

export interface ClosingPreview {
  checklist: unknown;
  period: { id: string; competence: string; closed_at: string; closed_by: string; totals: Record<string, number> } | null;
  rows: OverviewRow[];
}

export function useClosingPreview(teamId: string | null, month: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-closing", "preview", teamId, user?.id, month],
    enabled: enabled && !!teamId && !!user && !!month,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_close_preview", { _team_id: teamId!, _month: `${month}-01` });
      if (error) throw error;
      const d = data as any;
      return { ...d, rows: ((d?.rows ?? []) as any[]).map((r) => ({ ...r, gross: Number(r.gross), tax: Number(r.tax), direct_expenses: Number(r.direct_expenses), allocated_expenses: Number(r.allocated_expenses), team_cost: Number(r.team_cost), hours_realized: Number(r.hours_realized), hours_planned: Number(r.hours_planned), hours_without_cost: Number(r.hours_without_cost), margin_target: Number(r.margin_target) })) } as ClosingPreview;
    },
  });
}

export interface PeriodRow { id: string; competence: string; closed_at: string; closed_by: string; totals: any }
export interface AdjustmentRow { id: string; period_id: string; board_id: string; target: string; amount: number; reason: string; created_by: string; created_at: string }

export function useClosingHistory(teamId: string | null, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-closing", "history", teamId, user?.id],
    enabled: enabled && !!teamId && !!user,
    queryFn: async () => {
      const [p, a] = await Promise.all([
        supabase.from("finance_periods").select("id, competence, closed_at, closed_by, totals").eq("team_id", teamId!).order("competence", { ascending: false }),
        supabase.from("finance_period_adjustments").select("*").eq("team_id", teamId!).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      return { periods: (p.data ?? []) as PeriodRow[], adjustments: ((a.data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as AdjustmentRow[] };
    },
  });
}
