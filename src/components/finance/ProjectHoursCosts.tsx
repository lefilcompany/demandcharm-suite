import { downloadFinancePdf } from "@/lib/finance/pdfExport";
import { MonthField } from "@/components/ops/MonthField";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AlertTriangle, CheckCircle2, CircleDot, RotateCw, Scissors, Timer, Copy } from "lucide-react";
import { ExportReportButton } from "@/components/finance/ExportReportButton";
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
        <MonthField aria-label="Mês" value={month} onChange={setMonth} className="h-8 w-40" />
        {canExport && r && <ExportReportButton className="h-8" onExport={(f) => (f === "pdf" ? downloadFinancePdf(hoursCostsCsv(r), `Horas e custos ${month}`, `horas-custos-${month}.pdf`) : download())} />}
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
            <Cell label="Reais / previstas" value={`${fmtHours(s.actual_hours ?? 0)} / ${fmtHours(s.planned_hours ?? s.internal_hours)}`} note={`${s.people_count} pessoa(s) no projeto`} />
            <Cell label="Externo · prestador" value={`${fmtHours(s.client_external_hours)} · ${fmtHours(s.contractor_hours)}`}
              note={s.unclassified_hours > 0 ? `${fmtHours(s.unclassified_hours)} sem vínculo` : "Todos classificados"} warn={s.unclassified_hours > 0} />
            <Cell label="Custo de pessoal" value={brl(Number(s.personnel_cost))}
              note={s.missing_cost_people > 0 ? `Incompleto: ${s.missing_cost_people} sem custo (${fmtHours(s.missing_cost_hours)})` : "Custo completo"} warn={s.missing_cost_people > 0} />
            <Cell label="Horas sem projeto" value={fmtHours(s.pending_hours)} note="Na equipe, aguardando destino" warn={s.pending_hours > 0} />
          </section>

          <TeamTable r={r} />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <OpsLabel className="text-muted-foreground">Auditoria de apontamentos</OpsLabel>
                {r.audit.overlap_entries === 0 && r.audit.running_entries === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />Tudo certo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <AlertTriangle className="h-3 w-3" />Verifique
                  </span>
                )}
              </div>
              <ul className="mt-2 divide-y">
                <li className="flex items-start gap-2.5 py-2">
                  <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium leading-tight">Apontamentos sobrepostos</p>
                    <p className="text-xs text-muted-foreground">Horas lançadas duas vezes no mesmo período</p>
                  </div>
                  <span className={cn("text-right tabular-nums", r.audit.overlap_entries > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>
                    {r.audit.overlap_entries === 0 ? "Nenhum" : `${r.audit.overlap_entries} · ${fmtHours(r.audit.overlap_hours_removed)} descontadas`}
                  </span>
                </li>
                <li className="flex items-start gap-2.5 py-2">
                  <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium leading-tight">Divididos na virada do mês</p>
                    <p className="text-xs text-muted-foreground">Apontamentos que começam num mês e terminam no outro</p>
                  </div>
                  <span className="text-right tabular-nums text-muted-foreground">{r.audit.split_entries === 0 ? "Nenhum" : r.audit.split_entries}</span>
                </li>
                <li className="flex items-start gap-2.5 py-2">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium leading-tight">Timers em andamento</p>
                    <p className="text-xs text-muted-foreground">Ainda rodando; entram no custo quando forem parados</p>
                  </div>
                  <span className={cn("text-right tabular-nums", r.audit.running_entries > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>
                    {r.audit.running_entries === 0 ? "Nenhum" : r.audit.running_entries}
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <OpsLabel className="text-muted-foreground">Despesas do mês</OpsLabel>
              <ul className="mt-2 space-y-1.5">
                <li className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5"><CircleDot className="h-3 w-3 text-muted-foreground" />Despesas diretas do projeto</span>
                  <span className="tabular-nums font-medium">{brl(Number(r.expenses.direct))}</span>
                </li>
                <li className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5"><CircleDot className="h-3 w-3 text-muted-foreground" />Rateio de custos fixos</span>
                  <span className="tabular-nums font-medium">{brl(Number(r.expenses.fixa))}</span>
                </li>
                <li className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5"><CircleDot className="h-3 w-3 text-muted-foreground" />Rateio de custos operacionais</span>
                  <span className="tabular-nums font-medium">{brl(Number(r.expenses.operacional))}</span>
                </li>
                <li className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5"><CircleDot className="h-3 w-3 text-muted-foreground" />Rateio de custos administrativos</span>
                  <span className="tabular-nums font-medium">{brl(Number(r.expenses.administrativa))}</span>
                </li>
              </ul>
              {Number(r.expenses.team_unallocated) > 0 && (
                <p className="mt-2 flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-xs text-primary">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {brl(Number(r.expenses.team_unallocated))} de custos da equipe sem projeto para receber rateio
                </p>
              )}
              <p className="mt-2 flex items-baseline justify-between gap-2 border-t pt-2">
                <span className="font-semibold">Total de despesas do projeto</span>
                <span className="tabular-nums font-semibold">
                  {brl(Number(r.expenses.direct) + Number(r.expenses.fixa) + Number(r.expenses.operacional) + Number(r.expenses.administrativa))}
                </span>
              </p>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function TeamTable({ r }: { r: HoursCostsReport }) {
  if (!r.can_see_people) return <p className="text-xs text-muted-foreground">Valores por pessoa ficam visíveis só para quem tem acesso a custos individuais.</p>;
  const people = r.people ?? [];
  if (people.length === 0) return <p className="text-sm text-muted-foreground">Nenhum integrante com horas previstas neste projeto no mês.</p>;
  const totalCost = people.reduce((a, p) => a + Number(p.cost ?? 0), 0);
  return (
    <section aria-label="Integrantes do projeto" className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-2 px-4 py-2.5 border-b">
        <OpsLabel className="text-muted-foreground">Integrantes do projeto</OpsLabel>
        <span className="text-xs text-muted-foreground tabular-nums">{people.length} pessoa(s) · {brl(totalCost)}</span>
      </header>
      <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_6rem_7rem] gap-4 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
        <span>Pessoa</span><span>Horas reais x previstas</span><span className="text-right">Custo/h</span><span className="text-right">Custo no mês</span>
      </div>
      <ul className="divide-y text-sm">
        {people.map((p) => {
          const planned = Number(p.hours) || 0;
          const actual = Number(p.actual_hours ?? 0) || 0;
          const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;
          const over = planned > 0 && actual > planned;
          const width = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
          return (
            <li key={p.user_id} className="grid grid-cols-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_6rem_7rem] items-center gap-x-4 gap-y-2 px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0 col-span-2 md:col-span-1">
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(p.name)}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium leading-tight">{p.name}</p>
                  <p className={cn("text-xs", p.kind ? "text-muted-foreground" : "text-primary")}>{kindLabel(p.kind)}</p>
                </div>
              </div>
              <div className="col-span-2 md:col-span-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                  <span><span className="font-semibold text-foreground">{fmtHours(actual)}</span><span className="text-muted-foreground"> / {fmtHours(planned)}</span></span>
                  <span className={cn("font-medium", over ? "text-destructive" : "text-muted-foreground")}>{pct == null ? "—" : `${pct}%`}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label={`Horas reais de ${p.name}`}>
                  <div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${width}%` }} />
                </div>
              </div>
              <span className="tabular-nums text-left md:text-right text-muted-foreground">{p.hourly_cost == null ? "—" : `${brl(Number(p.hourly_cost))}/h`}</span>
              <span className={cn("tabular-nums text-right font-semibold", p.cost == null && "text-primary")}>{p.cost == null ? "Sem custo" : brl(Number(p.cost))}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
