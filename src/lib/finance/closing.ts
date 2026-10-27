// Pure monthly-closing helpers. The database enforces the same rules (finance_close_period).

export type ChecklistCode =
  | "running_timers" | "unclassified_expenses" | "revenue_without_value" | "hours_without_cost"
  | "incomplete_allocations" | "unallocated_amount" | "totals_mismatch" | "boards_without_revenue";

export interface ChecklistItem { code: ChecklistCode; severity: "block" | "warn"; count: number; amount: number | null }

export const CHECKLIST_TEXT: Record<ChecklistCode, { label: string; help: string }> = {
  running_timers: { label: "Apontamentos em andamento", help: "Timers ainda ligados que começaram até o fim do mês. Encerre-os para que as horas fiquem completas." },
  unclassified_expenses: { label: "Despesas não classificadas", help: "Despesas do mês sem categoria ou sem descrição." },
  revenue_without_value: { label: "Receitas sem valor", help: "Lançamentos de faturamento do mês com valor zero. Toda receita já tem mês de competência obrigatório." },
  hours_without_cost: { label: "Colaboradores sem custo/hora", help: "Pessoas com horas apontadas no mês e sem custo mensal cadastrado para a competência." },
  incomplete_allocations: { label: "Rateios incompletos", help: "Despesas compartilhadas cujo filtro de quadros está vazio ou aponta para quadros de fora da equipe." },
  unallocated_amount: { label: "Valores não distribuídos", help: "Parte de despesas compartilhadas que não encontrou base (horas ou faturamento) para ser dividida." },
  totals_mismatch: { label: "Inconsistência nos totais", help: "Diferença entre o total de despesas da equipe e a soma distribuída nos quadros." },
  boards_without_revenue: { label: "Quadros com custo e sem faturamento", help: "Quadros que tiveram custos no mês mas nenhuma receita lançada." },
};

export const normalizeChecklist = (raw: unknown): ChecklistItem[] =>
  ((raw as any[]) ?? []).map((i) => ({
    code: i.code, severity: i.severity === "block" ? "block" : "warn",
    count: Number(i.count ?? 0), amount: i.amount == null ? null : Number(i.amount),
  }));

export const blockingItems = (items: ChecklistItem[]) => items.filter((i) => i.severity === "block" && i.count > 0);
export const canClose = (items: ChecklistItem[]) => items.length > 0 && blockingItems(items).length === 0;

/** A month can only be closed after it has ended. `month` is YYYY-MM. */
export const monthEnded = (month: string, today: Date) => month < today.toISOString().substring(0, 7);

export type AdjustmentTarget = "gross" | "tax" | "direct_expenses" | "allocated_expenses" | "team_cost";
export const ADJUSTMENT_LABEL: Record<AdjustmentTarget, string> = {
  gross: "Faturamento bruto", tax: "Impostos", direct_expenses: "Despesas diretas", allocated_expenses: "Rateio", team_cost: "Custo da equipe",
};

export interface SnapshotValues { board_id: string; gross: number; tax: number; direct_expenses: number; allocated_expenses: number; team_cost: number }
export interface Adjustment { board_id: string; target: AdjustmentTarget; amount: number }

/** Snapshot + adjustments; never mutates the snapshot. */
export function applyAdjustments<T extends SnapshotValues>(snap: T[], adj: Adjustment[]): T[] {
  return snap.map((s) => {
    const out = { ...s };
    for (const a of adj) if (a.board_id === s.board_id) out[a.target] = Math.round((out[a.target] + a.amount) * 100) / 100;
    return out;
  });
}
