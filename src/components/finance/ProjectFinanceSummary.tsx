import { MonthRangeField } from "@/components/ops/MonthRangeField";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { OpsLabel } from "@/components/ops/OpsParts";
import { MarginGoalBar } from "./MarginRuler";
import { AlertTriangle, RotateCw, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatPct, resultTone, STATUS_LABEL } from "@/lib/finance/engine";
import { projectResult, type ProjectMonth } from "@/lib/finance/projectRollup";
import { fmtHours } from "@/lib/finance/timeSlices";

export function useProjectFinanceOverview(projectId: string, month: string, toMonth: string = month) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-finance-overview", projectId, month, toMonth, user?.id],
    enabled: !!user && !!projectId,
    retry: (n, e: any) => !String(e?.message).includes("FORBIDDEN") && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_finance_overview", { _project_id: projectId, _from: `${month}-01`, _to: `${toMonth}-01` });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectMonth[];
    },
  });
}

function Cell({ label, value, note, warn, tone }: { label: string; value: string; note?: string; warn?: boolean; tone?: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 border-ops-ink-foreground/10 [&:not(:first-child)]:border-l">
      <OpsLabel>{label}</OpsLabel>
      <span className={cn("font-ops-display text-2xl font-semibold leading-none tabular-nums", tone || (warn ? "text-primary" : "text-ops-ink-foreground"))}>{value}</span>
      {note && <span className="text-xs text-ops-ink-foreground/70">{note}</span>}
    </div>
  );
}

export function ProjectFinanceSummary({ projectId, from, to, onRange }: { projectId: string; from: string; to: string; onRange: (from: string, to: string) => void }) {
  const q = useProjectFinanceOverview(projectId, from, to);
  if (q.isError && String((q.error as any)?.message).includes("FORBIDDEN"))
    return <p className="text-sm text-muted-foreground">Você ainda não tem acesso aos números deste projeto. O dono da equipe pode liberar em Configurações da equipe.</p>;
  const r = q.data && q.data.length ? projectResult(q.data) : null;
  const m0 = q.data?.[0];
  const single = from === to;
  const closedCount = (q.data ?? []).filter((m) => m.period_status !== "open").length;
  const taxRate = single && m0 ? Number(m0.tax_rate) : r && r.gross > 0 ? r.tax / r.gross : Number(m0?.tax_rate ?? 0);
  const adjustments = (q.data ?? []).flatMap((m) => m.adjustments ?? []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium flex-1">Resultado do projeto</h3>
        {closedCount > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{single ? (m0?.has_adjustments ? "Fechado + ajustes" : "Mês fechado") : `${closedCount} ${closedCount === 1 ? "mês fechado" : "meses fechados"}`}</span>}
        <MonthRangeField from={from} to={to} onChange={onRange} />
      </div>
      {q.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />Não foi possível carregar o resultado.
          <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => q.refetch()}><RotateCw className="h-3.5 w-3.5 mr-1" />Tentar de novo</Button>
        </div>
      ) : !r || !m0 ? <Skeleton className="h-28 w-full rounded-xl" /> : (
        <section aria-label="Resultado do projeto" className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4">
            <Cell label="Faturamento" value={formatBRL(r.gross)} note={`Impostos ${formatBRL(r.tax)} · ${formatPct(taxRate)}`} />
            <Cell label="Custo total" value={formatBRL(r.totalCost + r.totals.variable)} note={`Pessoal ${formatBRL(r.totals.teamCost)} · ${fmtHours(r.totals.hours)}`}
              warn={r.totals.hoursWithoutCost > 0} />
            <Cell label="Resultado" value={formatBRL(r.result)} note={STATUS_LABEL[r.status]} tone={resultTone(r.result)} />
            <Cell label="Margem de lucro" value={r.margin == null ? "—" : formatPct(r.margin)} note={`Meta da equipe: ${formatPct(r.totals.marginTarget)}`}
              tone={r.margin == null ? "" : r.margin < 0 ? "text-destructive" : r.margin >= r.totals.marginTarget ? "text-success" : "text-primary"} />
          </div>
          <div className="px-4 pb-4 pt-1"><MarginGoalBar margin={r.margin} target={r.totals.marginTarget} variant="ink" /></div>
          {r.totals.hoursWithoutCost > 0 && (
            <p className="px-4 pb-3 text-xs text-primary">Custo incompleto: {fmtHours(r.totals.hoursWithoutCost)} de pessoas sem custo cadastrado no período.</p>
          )}
          {(q.data ?? []).every((m) => m.board_ids.length === 0) && <p className="px-4 pb-3 text-xs text-ops-ink-foreground/70">Nenhum quadro vinculado no período.</p>}
        </section>
      )}
      {adjustments.length > 0 && (
        <div className="rounded-lg border text-sm">
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">Ajustes depois do fechamento</p>
          <ul className="divide-y">
            {adjustments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2">
                <span className="font-medium">{a.board_name ?? "Quadro"}</span>
                <span className="text-muted-foreground">{ADJ_LABEL[a.target] ?? a.target}</span>
                <span className={cn("tabular-nums ml-auto", a.amount < 0 && "text-destructive")}>{formatBRL(Number(a.amount))}</span>
                <span className="basis-full text-xs text-muted-foreground">
                  {a.reason} · {a.author ?? "—"} · {a.created_at.substring(0, 10).split("-").reverse().join("/")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const ADJ_LABEL: Record<string, string> = {
  gross: "Faturamento", tax: "Impostos", direct_expenses: "Despesas diretas", allocated_expenses: "Rateios", team_cost: "Custo de pessoal",
};

/** Team-wide financial values. Every project uses them — the project tab is read-only. */
export function ProjectFinanceSettings({ projectId }: { projectId: string; canManage?: boolean }) {
  const thisMonth = new Date().toISOString().substring(0, 7);
  const team = useQuery({
    queryKey: ["project-finance-team", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("team_id").eq("id", projectId).single();
      if (error) throw error;
      return (data?.team_id ?? null) as string | null;
    },
  });
  const def = useQuery({
    queryKey: ["finance-team-defaults", team.data],
    enabled: !!team.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_team_defaults")
        .select("valid_from, tax_rate, variable_rate, margin_target, allocation_pct")
        .eq("team_id", team.data!).order("valid_from", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as { valid_from: string; tax_rate: number; variable_rate: number; margin_target: number; allocation_pct: number } | null;
    },
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Estes valores são gerais da equipe e valem para todos os projetos. Não é preciso configurar nada aqui.
      </p>
      {def.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar os valores da equipe.</p>
      ) : !def.data ? (
        <p className="text-sm text-muted-foreground">A equipe ainda não definiu esses valores.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {[
            { k: "Impostos (NF)", v: formatPct(Number(def.data.tax_rate)) },
            { k: "Custos variáveis", v: formatPct(Number(def.data.variable_rate)) },
            { k: "Meta de margem", v: formatPct(Number(def.data.margin_target)) },
            { k: "Rateio", v: formatPct(Number(def.data.allocation_pct)) },
          ].map((x) => (
            <li key={x.k} className="flex items-center justify-between px-3 py-2">
              <span className="text-muted-foreground">{x.k}</span>
              <span className="tabular-nums font-medium">{x.v}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Em vigor desde {thisMonth.split("-").reverse().join("/")}. Para mudar, use Custos da equipe na Gestão Financeira.</p>
    </div>
  );
}
