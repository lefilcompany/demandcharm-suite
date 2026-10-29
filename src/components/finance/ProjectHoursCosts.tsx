import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AlertTriangle, Download, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtHours, hoursCostsCsv, kindLabel, type HoursCostsReport } from "@/lib/finance/timeSlices";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function useProjectHoursCosts(projectId: string, competence: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-hours-costs", projectId, competence, user?.id],
    enabled: !!user && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_hours_costs" as any, { _project_id: projectId, _competence: competence });
      if (error) throw error;
      return data as unknown as HoursCostsReport;
    },
  });
}

function Cell({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 border-ops-ink-foreground/10 [&:not(:first-child)]:border-l">
      <OpsLabel>{label}</OpsLabel>
      <span className={cn("font-ops-display text-2xl font-semibold leading-none tabular-nums", warn ? "text-primary" : "text-ops-ink-foreground")}>{value}</span>
      {note && <span className="text-xs text-ops-ink-foreground/70">{note}</span>}
    </div>
  );
}

export function ProjectHoursCosts({ projectId, canExport }: { projectId: string; canExport?: boolean }) {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const competence = `${month}-01`;
  const q = useProjectHoursCosts(projectId, competence);
  const r = q.data;
  const s = r?.summary;

  const download = () => {
    if (!r) return;
    const url = URL.createObjectURL(new Blob(["\ufeff" + hoursCostsCsv(r)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `horas-custos-${month}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (q.isError && String((q.error as any)?.message).includes("FORBIDDEN")) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium flex-1">Horas e custos</h3>
        <Input type="month" aria-label="Mês" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 w-40" />
        {canExport && r && <Button variant="outline" size="sm" className="h-8" onClick={download}><Download className="h-4 w-4 mr-1" />CSV</Button>}
      </div>

      {q.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />Não foi possível carregar as horas deste mês.
          <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => q.refetch()}><RotateCw className="h-3.5 w-3.5 mr-1" />Tentar de novo</Button>
        </div>
      ) : q.isLoading || !s ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <>
          <section aria-label="Resumo de horas e custos" className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden grid grid-cols-2 md:grid-cols-4">
            <Cell label="Horas internas" value={fmtHours(s.internal_hours)} note={`${s.people_count} pessoa(s) no projeto`} />
            <Cell label="Externo · prestador" value={`${fmtHours(s.client_external_hours)} · ${fmtHours(s.contractor_hours)}`}
              note={s.unclassified_hours > 0 ? `${fmtHours(s.unclassified_hours)} sem vínculo` : "Todos classificados"} warn={s.unclassified_hours > 0} />
            <Cell label="Custo de pessoal" value={brl(Number(s.personnel_cost))}
              note={s.missing_cost_people > 0 ? `Incompleto: ${s.missing_cost_people} sem custo (${fmtHours(s.missing_cost_hours)})` : "Custo completo"} warn={s.missing_cost_people > 0} />
            <Cell label="Horas sem projeto" value={fmtHours(s.pending_hours)} note="Na equipe, aguardando destino" warn={s.pending_hours > 0} />
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3 space-y-1.5 text-sm">
              <OpsLabel className="text-muted-foreground">Auditoria de apontamentos</OpsLabel>
              <p>{r.audit.overlap_entries} sobreposto(s) · {fmtHours(r.audit.overlap_hours_removed)} contadas uma vez só</p>
              <p>{r.audit.split_entries} dividido(s) na virada do mês</p>
              <p className={cn(r.audit.running_entries > 0 && "text-primary")}>{r.audit.running_entries} timer(s) em andamento</p>
            </div>
            <div className="rounded-lg border p-3 space-y-1.5 text-sm">
              <OpsLabel className="text-muted-foreground">Despesas do mês</OpsLabel>
              <p className="flex justify-between"><span>Diretas</span><span className="tabular-nums">{brl(Number(r.expenses.direct))}</span></p>
              <p className="flex justify-between"><span>Rateio fixa</span><span className="tabular-nums">{brl(Number(r.expenses.fixa))}</span></p>
              <p className="flex justify-between"><span>Rateio operacional</span><span className="tabular-nums">{brl(Number(r.expenses.operacional))}</span></p>
              <p className="flex justify-between"><span>Rateio administrativa</span><span className="tabular-nums">{brl(Number(r.expenses.administrativa))}</span></p>
              {Number(r.expenses.team_unallocated) > 0 && (
                <p className="flex justify-between text-primary"><span>Não alocado na equipe</span><span className="tabular-nums">{brl(Number(r.expenses.team_unallocated))}</span></p>
              )}
            </div>
          </div>

          {r.can_see_people ? (
            r.people && r.people.length > 0 ? (
              <ul className="divide-y rounded-lg border text-sm">
                {r.people.map((p) => (
                  <li key={p.user_id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className={cn("text-xs", p.kind ? "text-muted-foreground" : "text-primary")}>{kindLabel(p.kind)}</p>
                    </div>
                    <span className="tabular-nums w-16 text-right">{fmtHours(p.hours)}</span>
                    <span className="tabular-nums w-24 text-right text-muted-foreground">{p.hourly_cost == null ? "—" : `${brl(p.hourly_cost)}/h`}</span>
                    <span className={cn("tabular-nums w-24 text-right", p.cost == null && "text-primary font-medium")}>{p.cost == null ? "Sem custo" : brl(p.cost)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nenhuma hora apontada neste projeto no mês.</p>
          ) : <p className="text-xs text-muted-foreground">Valores por pessoa ficam visíveis só para quem tem acesso a custos individuais.</p>}
        </>
      )}
    </div>
  );
}
