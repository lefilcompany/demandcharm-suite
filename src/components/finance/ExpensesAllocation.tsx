import { useMemo, useState } from "react";
import { RefreshCw, Settings2, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFinanceMutation, type OverviewRow } from "@/hooks/useFinance";
import { SharedExpenseSheet } from "@/components/finance/SharedExpenseSheet";
import { AllocationRow } from "@/hooks/useFinance";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AllocationBar, toneFor } from "@/components/finance/AllocationBar";
import { EXPENSE_TYPE_LABEL, METHOD_LABEL, AllocationMethod } from "@/lib/finance/allocation";
import { formatBRL } from "@/lib/finance/engine";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

export function ExpensesAllocation({ rows, isLoading, isError, onRetry, boardOrder, canEdit = false, teamId, boards = [], overview = [] }: {
  rows: AllocationRow[]; isLoading: boolean; isError: boolean; onRetry: () => void; boardOrder: string[];
  canEdit?: boolean; teamId?: string | null; boards?: { id: string; name: string }[]; overview?: OverviewRow[];
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const remove = useFinanceMutation(async (id: string) => {
    const { error } = await supabase.from("finance_expenses").delete().eq("id", id);
    if (error) throw error;
  });
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
  const unallocated = expenses.reduce((s, e) => s + Math.max(0, e.unallocated), 0);
  const surplus = expenses.reduce((s, e) => s + Math.max(0, -e.unallocated), 0);

  const bar = (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-semibold">Configuração de rateio</p>
        <p className="text-xs text-muted-foreground">{canEdit ? "Defina como os gastos da equipe são divididos entre os quadros." : "Somente o dono da equipe ou o gestor financeiro pode alterar o rateio."}</p>
      </div>
      {canEdit && teamId ? <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Settings2 className="h-4 w-4" />Configurar rateio</Button>
        : <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" />Somente leitura</span>}
      {canEdit && teamId && <SharedExpenseSheet open={open} onOpenChange={setOpen} teamId={teamId} boards={boards} overview={overview} />}
    </div>
  );

  if (isError) return (
    <div className="rounded-xl border p-6 text-center space-y-2">
      <p className="text-sm">Não foi possível carregar os rateios.</p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}><RefreshCw className="h-4 w-4" />Tentar de novo</Button>
    </div>
  );
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!expenses.length) return (<div className="space-y-4">{bar}
    <div className="rounded-xl border bg-card p-8 text-center space-y-1">
      <p className="font-medium">Nenhuma despesa compartilhada no período.</p>
      <p className="text-sm text-muted-foreground">{canEdit ? "Clique em \"Configurar rateio\" para lançar aluguel, ferramentas ou administrativo e escolher como dividir entre os quadros." : "Quando o gestor financeiro configurar um rateio, ele aparece aqui."}</p>
    </div></div>
  );

  return (
    <div className="space-y-4">
      {bar}
      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><OpsLabel>Rateio recebido pelos quadros</OpsLabel><div className="font-ops-display text-3xl font-semibold tabular-nums">{formatBRL(received)}</div></div>
          {unallocated > 0 && <div className="text-right"><OpsLabel>Não rateado</OpsLabel><div className="font-ops-display text-2xl font-semibold tabular-nums text-primary">{formatBRL(unallocated)}</div></div>}
          {surplus > 0 && <div className="text-right"><OpsLabel>Folga de rateio</OpsLabel><div className="font-ops-display text-2xl font-semibold tabular-nums">{formatBRL(surplus)}</div></div>}
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
        {expenses.map(({ head, parts, unallocated: raw }) => {
          const u = Math.max(0, raw), extra = Math.max(0, -raw);
          const shown = parts.reduce((s, p) => s + p.amount, 0) + u;
          return (
            <article key={head.expense_id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{head.description}</h3>
                  <OpsLabel>{monthLabel(head.competence)} · {EXPENSE_TYPE_LABEL[head.expense_type] ?? head.expense_type} · {METHOD_LABEL[head.allocation_method as AllocationMethod] ?? head.allocation_method}</OpsLabel>
                </div>
                <div className="flex items-center gap-1">
                  <span className="tabular-nums font-semibold">{formatBRL(head.total)}</span>
                  {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover rateio" disabled={remove.isPending}
                    onClick={() => { if (confirm(`Remover o rateio "${head.description}"?`)) remove.mutate(head.expense_id, { onSuccess: () => toast({ title: "Rateio removido" }), onError: () => toast({ title: "Não foi possível remover (o mês pode estar fechado).", variant: "destructive" }) }); }}>
                    <Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
              <AllocationBar total={Math.max(head.total, shown)} unallocated={u} order={boardOrder}
                parts={parts.map((p) => ({ key: p.board_id!, label: p.board_name ?? "Quadro", amount: p.amount }))} />
              {u > 0 && <p className="text-xs text-primary">{formatBRL(u)}{head.allocation_method === "revenue_pct" ? " não absorvido pelos contratos (o percentual fixo não cobriu a despesa)." : " sem quadro com base no mês: entra no resultado da equipe só quando houver horas ou faturamento."}</p>}
              {extra > 0 && <p className="text-xs text-muted-foreground">Folga de {formatBRL(extra)}: os contratos pagaram mais que a despesa, sem diminuir a parte de ninguém.</p>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
