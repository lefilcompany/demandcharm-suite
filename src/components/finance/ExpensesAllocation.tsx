import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { AllocationRow } from "@/hooks/useFinance";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AllocationBar, toneFor } from "@/components/finance/AllocationBar";
import { EXPENSE_TYPE_LABEL, METHOD_LABEL, AllocationMethod } from "@/lib/finance/allocation";
import { formatBRL } from "@/lib/finance/engine";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

export function ExpensesAllocation({ rows, isLoading, isError, onRetry, boardOrder }: {
  rows: AllocationRow[]; isLoading: boolean; isError: boolean; onRetry: () => void; boardOrder: string[];
}) {
  const expenses = useMemo(() => {
    const m = new Map<string, { head: AllocationRow; parts: AllocationRow[]; unallocated: number }>();
    rows.forEach((r) => {
      const e = m.get(r.expense_id) ?? { head: r, parts: [], unallocated: 0 };
      if (r.board_id) e.parts.push(r); else e.unallocated += r.amount;
      m.set(r.expense_id, e);
    });
    return [...m.values()].sort((a, b) => b.head.competence.localeCompare(a.head.competence) || b.head.total - a.head.total);
  }, [rows]);
  const perBoard = useMemo(() => {
    const m = new Map<string, { name: string; amount: number }>();
    rows.filter((r) => r.board_id).forEach((r) => m.set(r.board_id!, { name: r.board_name ?? "Quadro", amount: (m.get(r.board_id!)?.amount ?? 0) + r.amount }));
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount);
  }, [rows]);
  const received = perBoard.reduce((s, b) => s + b.amount, 0);
  const unallocated = expenses.reduce((s, e) => s + e.unallocated, 0);

  if (isError) return (
    <div className="rounded-xl border p-6 text-center space-y-2">
      <p className="text-sm">Não foi possível carregar os rateios.</p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}><RefreshCw className="h-4 w-4" />Tentar de novo</Button>
    </div>
  );
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!expenses.length) return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-1">
      <p className="font-medium">Nenhuma despesa compartilhada no período.</p>
      <p className="text-sm text-muted-foreground">Lance aluguel, ferramentas da equipe ou administrativo em "Lançamentos e acesso" e escolha como dividir entre os quadros.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><OpsLabel>Rateio recebido pelos quadros</OpsLabel><div className="font-ops-display text-3xl font-semibold tabular-nums">{formatBRL(received)}</div></div>
          {unallocated > 0 && <div className="text-right"><OpsLabel>Não rateado</OpsLabel><div className="font-ops-display text-2xl font-semibold tabular-nums text-primary">{formatBRL(unallocated)}</div></div>}
        </div>
        <AllocationBar className="h-4 bg-ops-ink-foreground/10" total={received + unallocated} unallocated={unallocated} order={boardOrder}
          parts={perBoard.map((b) => ({ key: b.id, label: b.name, amount: b.amount }))} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {perBoard.map((b) => (
            <li key={b.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: toneFor(b.id, boardOrder) }} />{b.name} <span className="tabular-nums opacity-70">{formatBRL(b.amount)}</span></li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card divide-y">
        {expenses.map(({ head, parts, unallocated: u }) => {
          const shown = parts.reduce((s, p) => s + p.amount, 0) + u;
          return (
            <article key={head.expense_id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{head.description}</h3>
                  <OpsLabel>{monthLabel(head.competence)} · {EXPENSE_TYPE_LABEL[head.expense_type] ?? head.expense_type} · {METHOD_LABEL[head.allocation_method as AllocationMethod] ?? head.allocation_method}</OpsLabel>
                </div>
                <span className="tabular-nums font-semibold">{formatBRL(head.total)}</span>
              </div>
              <AllocationBar total={Math.max(head.total, shown)} unallocated={u} order={boardOrder}
                parts={parts.map((p) => ({ key: p.board_id!, label: p.board_name ?? "Quadro", amount: p.amount }))} />
              {u > 0 && <p className="text-xs text-primary">{formatBRL(u)} sem quadro com base no mês: entra no resultado da equipe só quando houver horas ou faturamento.</p>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
