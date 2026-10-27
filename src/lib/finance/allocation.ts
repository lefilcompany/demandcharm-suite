// Shared-expense allocation. Mirrors SQL `_finance_allocations` — keep both identical.
export type AllocationMethod = "hours" | "revenue" | "mixed";

export interface BoardBase { boardId: string; hours: number; gross: number }
export interface AllocationInput {
  amount: number;
  method: AllocationMethod;
  /** share decided by hours when method = mixed (0..1), default 0.5 */
  hoursWeight?: number;
  /** limit to these boards; undefined/empty = every board */
  boardIds?: string[] | null;
}
export interface AllocationOutput { parts: { boardId: string; amount: number; share: number }[]; unallocated: number }

const r2 = (v: number) => Math.round(v * 100) / 100;

export function allocate(input: AllocationInput, bases: BoardBase[]): AllocationOutput {
  const w = input.method === "hours" ? 1 : input.method === "revenue" ? 0 : Math.min(1, Math.max(0, input.hoursWeight ?? 0.5));
  const elig = input.boardIds?.length ? bases.filter((b) => input.boardIds!.includes(b.boardId)) : bases;
  const sh = elig.reduce((s, b) => s + b.hours, 0);
  const sg = elig.reduce((s, b) => s + b.gross, 0);
  const shares = elig
    .map((b) => ({ boardId: b.boardId, share: (sh > 0 ? (w * b.hours) / sh : 0) + (sg > 0 ? ((1 - w) * b.gross) / sg : 0) }))
    .filter((p) => p.share > 0);
  const totalShare = shares.reduce((s, p) => s + p.share, 0);
  const parts = shares.map((p) => ({ ...p, amount: r2(input.amount * p.share) }));
  if (parts.length) {
    const resid = r2(r2(input.amount * totalShare) - parts.reduce((s, p) => s + p.amount, 0));
    const top = [...parts].sort((a, b) => b.share - a.share || a.boardId.localeCompare(b.boardId))[0];
    top.amount = r2(top.amount + resid);
  }
  const allocated = parts.reduce((s, p) => s + p.amount, 0);
  return { parts, unallocated: r2(input.amount - allocated) };
}

export const METHOD_LABEL: Record<AllocationMethod, string> = { hours: "Por horas", revenue: "Por receita", mixed: "Misto" };
export const EXPENSE_TYPE_LABEL: Record<string, string> = { fixa: "Fixa", operacional: "Operacional", administrativa: "Administrativa" };
