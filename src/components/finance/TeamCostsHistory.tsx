import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/finance/engine";
import { buildCostHistory, CostRow } from "@/lib/finance/costHistory";
import { TEAM_COST_LABEL, TEAM_COST_TYPES } from "@/lib/finance/projectShare";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtMonth = (iso: string) => `${MONTHS[Number(iso.substring(5, 7)) - 1]}/${iso.substring(0, 4)}`;
const fmtDate = (iso: string) => { const d = iso.substring(0, 10); return `${d.substring(8, 10)}/${d.substring(5, 7)}/${d.substring(0, 4)}`; };

/** Month-by-month view of team costs plus the list of every change, with dates. */
export function TeamCostsHistory({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useQuery({
    queryKey: ["finance-table", "team-costs-history", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_team_costs" as any)
        .select("cost_type, monthly_amount, valid_from, updated_at").eq("team_id", teamId).order("valid_from");
      if (error) throw error;
      return (data ?? []) as unknown as CostRow[];
    },
  });
  const h = useMemo(() => buildCostHistory(q.data ?? [], year), [q.data, year]);

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError) return <div className="rounded-xl border p-4 text-sm">Não foi possível carregar o histórico. <Button size="sm" variant="outline" onClick={() => q.refetch()}>Tentar de novo</Button></div>;
  const max = Math.max(1, ...h.months.map((m) => m.total));

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><History className="h-4 w-4" /></span>
          <div><h3 className="text-sm font-semibold">Histórico dos custos</h3><p className="text-xs text-muted-foreground">Quanto a equipe gastou por mês e quando cada valor mudou.</p></div></div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ano anterior" onClick={() => setYear(year - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-sm font-semibold tabular-nums">{year}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Próximo ano" onClick={() => setYear(year + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-xs text-muted-foreground">Total no ano</p><p className="font-ops-display text-2xl font-semibold tabular-nums">{formatBRL(h.yearTotal)}</p></div>
        <p className="text-xs text-muted-foreground">{h.changes.filter((c) => c.validFrom.startsWith(String(year))).length} alterações em {year}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs tabular-nums">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1.5 font-medium">Mês</th>
            {TEAM_COST_TYPES.map((t) => <th key={t} className="py-1.5 text-right font-medium">{TEAM_COST_LABEL[t]}</th>)}
            <th className="py-1.5 text-right font-medium">Total</th><th className="w-32 py-1.5" /></tr></thead>
          <tbody>{h.months.map((m) => (
            <tr key={m.month} className="border-t">
              <td className="py-1.5 font-medium">{fmtMonth(m.month)}</td>
              {TEAM_COST_TYPES.map((t) => <td key={t} className={`py-1.5 text-right ${m.changed.includes(t) ? "font-semibold text-primary" : ""}`}>{formatBRL(m.values[t])}</td>)}
              <td className="py-1.5 text-right font-semibold">{formatBRL(m.total)}</td>
              <td className="py-1.5 pl-3"><div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(m.total / max) * 100}%` }} /></div></td>
            </tr>))}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-muted-foreground">Valores em laranja mudaram naquele mês.</p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alterações</h4>
        {h.changes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum custo cadastrado ainda.</p> : (
          <ol className="space-y-2">{[...h.changes].reverse().map((c) => {
            const up = c.previous != null && c.amount > c.previous;
            const down = c.previous != null && c.amount < c.previous;
            return (
              <li key={`${c.type}-${c.validFrom}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div><p className="font-medium">{TEAM_COST_LABEL[c.type]} <span className="font-normal text-muted-foreground">· vale a partir de {fmtMonth(c.validFrom)}</span></p>
                  <p className="text-xs text-muted-foreground">Alterado em {fmtDate(c.changedAt)}</p></div>
                <div className="flex items-center gap-2 tabular-nums">
                  {c.previous == null ? <span className="text-xs text-muted-foreground">Valor inicial</span> : <span className="text-xs text-muted-foreground line-through">{formatBRL(c.previous)}</span>}
                  <span className="font-semibold">{formatBRL(c.amount)}</span>
                  {up && <span className="inline-flex items-center text-xs text-destructive"><ArrowUpRight className="h-3.5 w-3.5" />{formatBRL(c.amount - c.previous!)}</span>}
                  {down && <span className="inline-flex items-center text-xs text-success"><ArrowDownRight className="h-3.5 w-3.5" />{formatBRL(c.previous! - c.amount)}</span>}
                </div>
              </li>);
          })}</ol>
        )}
      </div>
    </section>
  );
}
