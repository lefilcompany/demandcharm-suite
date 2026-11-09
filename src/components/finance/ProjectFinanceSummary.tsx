import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { OpsLabel } from "@/components/ops/OpsParts";
import { MarginRuler } from "./MarginRuler";
import { AlertTriangle, RotateCw, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatPct, STATUS_LABEL } from "@/lib/finance/engine";
import { projectResult, settingsFor, type ProjectMonth } from "@/lib/finance/projectRollup";
import { fmtHours } from "@/lib/finance/timeSlices";

export function useProjectFinanceOverview(projectId: string, month: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-finance-overview", projectId, month, user?.id],
    enabled: !!user && !!projectId,
    retry: (n, e: any) => !String(e?.message).includes("FORBIDDEN") && n < 2,
    queryFn: async () => {
      const d = `${month}-01`;
      const { data, error } = await supabase.rpc("get_project_finance_overview", { _project_id: projectId, _from: d, _to: d });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectMonth[];
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

const FORBIDDEN_MSG = "Você ainda não tem acesso aos números deste projeto. O dono da equipe pode liberar em Configurações da equipe.";
const isForbidden = (e: unknown) => String((e as any)?.message).includes("FORBIDDEN");

/** Single dark strip with the project DRE for the month. */
export function ProjectHero({ projectId, month }: { projectId: string; month: string }) {
  const q = useProjectFinanceOverview(projectId, month);
  if (q.isError && isForbidden(q.error)) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">{FORBIDDEN_MSG}</p>;
  if (q.isError) return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4" />Não foi possível carregar o resultado.
      <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => q.refetch()}><RotateCw className="h-3.5 w-3.5 mr-1" />Tentar de novo</Button>
    </div>
  );
  const r = q.data && q.data.length ? projectResult(q.data) : null;
  const m0 = q.data?.[0];
  if (!r || !m0) return <Skeleton className="h-24 w-full rounded-xl" />;
  const t = r.totals;
  const alloc = t.fixed + t.operational + t.admin;
  return (
    <section aria-label="Resultado do projeto" className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
        <Cell label="Faturamento" value={formatBRL(r.gross)} note={`Impostos ${formatPct(Number(m0.tax_rate))}`} />
        <Cell label="Custo da equipe" value={formatBRL(t.teamCost)} note={fmtHours(t.hours)} warn={t.hoursWithoutCost > 0} />
        <Cell label="Rateios" value={formatBRL(alloc)} note={`Diretas ${formatBRL(t.direct + t.variable)}`} />
        <Cell label="Resultado" value={formatBRL(r.result)} note={STATUS_LABEL[r.status]} warn={r.result < 0} />
        <div className="col-span-2 md:col-span-1 flex flex-col gap-1 px-4 py-3 border-ops-ink-foreground/10 md:border-l">
          <div className="flex items-baseline justify-between gap-2">
            <OpsLabel>Margem</OpsLabel>
            <span className="text-xs text-ops-ink-foreground/70">meta {formatPct(t.marginTarget)}</span>
          </div>
          <span className={cn("font-ops-display text-2xl font-semibold leading-none tabular-nums", r.margin != null && r.margin < t.marginTarget ? "text-primary" : "text-ops-ink-foreground")}>
            {r.margin == null ? "—" : formatPct(r.margin)}
          </span>
          <MarginRuler margin={r.margin} target={t.marginTarget} compact />
        </div>
      </div>
      {(t.hoursWithoutCost > 0 || m0.board_ids.length === 0) && (
        <p className="border-t border-ops-ink-foreground/10 px-4 py-2 text-xs text-ops-ink-foreground/70">
          {t.hoursWithoutCost > 0 && <span className="text-primary">Custo incompleto: {fmtHours(t.hoursWithoutCost)} sem custo cadastrado. </span>}
          {m0.board_ids.length === 0 && "Nenhum quadro vinculado neste mês."}
        </p>
      )}
    </section>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between py-1.5", strong && "font-semibold border-t mt-1 pt-2", muted && "text-muted-foreground")}>
      <span>{label}</span><span className={cn("tabular-nums", value < 0 && "text-destructive")}>{formatBRL(value)}</span>
    </div>
  );
}

/** Overview tab: DRE composition + post-closing adjustments (no KPIs, those live in the hero). */
export function ProjectOverviewBody({ projectId, month }: { projectId: string; month: string }) {
  const q = useProjectFinanceOverview(projectId, month);
  if (q.isError) return null;
  const r = q.data && q.data.length ? projectResult(q.data) : null;
  const m0 = q.data?.[0];
  if (!r || !m0) return <Skeleton className="h-40 w-full rounded-lg" />;
  const t = r.totals;
  return (
    <div className="grid gap-6 lg:grid-cols-2 text-sm">
      <div>
        <OpsLabel className="text-muted-foreground">Composição do resultado</OpsLabel>
        <div className="mt-2">
          <Line label="Faturamento" value={r.gross} />
          <Line label="Impostos" value={-r.tax} muted />
          <Line label="Custo da equipe" value={-t.teamCost} muted />
          <Line label="Despesas diretas e variáveis" value={-(t.direct + t.variable)} muted />
          <Line label="Rateio fixa" value={-t.fixed} muted />
          <Line label="Rateio operacional" value={-t.operational} muted />
          <Line label="Rateio administrativa" value={-t.admin} muted />
          <Line label="Resultado" value={r.result} strong />
        </div>
      </div>
      <div>
        <OpsLabel className="text-muted-foreground">Ajustes depois do fechamento</OpsLabel>
        {m0.adjustments && m0.adjustments.length > 0 ? (
          <ul className="mt-2 divide-y">
            {m0.adjustments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="font-medium">{a.board_name ?? "Quadro"}</span>
                <span className="text-muted-foreground">{ADJ_LABEL[a.target] ?? a.target}</span>
                <span className={cn("tabular-nums ml-auto", a.amount < 0 && "text-destructive")}>{formatBRL(Number(a.amount))}</span>
                <span className="basis-full text-xs text-muted-foreground">
                  {a.reason} · {a.author ?? "—"} · {a.created_at.substring(0, 10).split("-").reverse().join("/")}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-muted-foreground">{m0.period_status === "open" ? "Mês aberto — ajustes só existem depois do fechamento." : "Nenhum ajuste neste mês."}</p>}
      </div>
    </div>
  );
}

/** Month status pill for the header. */
export function ProjectMonthStatus({ projectId, month }: { projectId: string; month: string }) {
  const q = useProjectFinanceOverview(projectId, month);
  const m0 = q.data?.[0];
  if (!m0) return null;
  const closed = m0.period_status !== "open";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs", closed ? "border-primary/40 text-primary" : "text-muted-foreground")}>
      {closed && <Lock className="h-3 w-3" />}{closed ? (m0.has_adjustments ? "Fechado + ajustes" : "Fechado") : "Aberto"}
    </span>
  );
}

const ADJ_LABEL: Record<string, string> = {
  gross: "Faturamento", tax: "Impostos", direct_expenses: "Despesas diretas", allocated_expenses: "Rateios", team_cost: "Custo de pessoal",
};

type SettingRow = { id: string; valid_from: string; tax_rate: number; variable_rate: number; margin_target: number };

export function ProjectFinanceSettings({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ["finance-project-settings", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_project_settings").select("id, valid_from, tax_rate, variable_rate, margin_target")
        .eq("project_id", projectId).order("valid_from", { ascending: false });
      if (error) throw error;
      return data as SettingRow[];
    },
  });
  const thisMonth = new Date().toISOString().substring(0, 7);
  const cur = settingsFor(rows.data ?? [], thisMonth);
  const [f, setF] = useState({ from: thisMonth, tax: "", variable: "", target: "" });
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["finance-project-settings", projectId] });
    qc.invalidateQueries({ queryKey: ["project-finance-overview", projectId] });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("finance_project_settings").insert({
      project_id: projectId, team_id: "00000000-0000-0000-0000-000000000000", valid_from: `${f.from}-01`,
      tax_rate: Number(f.tax) / 100, variable_rate: Number(f.variable || 0) / 100, margin_target: Number(f.target) / 100,
    });
    setBusy(false);
    if (error) return toast({ title: error.code === "23505" ? "Já existe configuração para esse mês." : "Não foi possível salvar.", variant: "destructive" });
    toast({ title: "Configuração salva" });
    setF({ ...f, tax: "", variable: "", target: "" });
    refresh();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("finance_project_settings").delete().eq("id", id);
    if (error) return toast({ title: "Não foi possível remover.", variant: "destructive" });
    refresh();
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {cur ? `Em vigor: impostos ${formatPct(Number(cur.tax_rate))}, custos variáveis ${formatPct(Number(cur.variable_rate))}, meta ${formatPct(Number(cur.margin_target))}.`
          : "Sem configuração própria: valem os parâmetros da equipe."}
      </p>
      {canManage && (
        <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <label className="space-y-1"><span className="text-xs text-muted-foreground">A partir de</span>
            <Input type="month" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} required className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-muted-foreground">Impostos %</span>
            <Input type="number" min={0} max={99} step="0.01" value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} required className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-muted-foreground">Custos variáveis %</span>
            <Input type="number" min={0} max={99} step="0.01" value={f.variable} onChange={(e) => setF({ ...f, variable: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-muted-foreground">Meta de margem %</span>
            <Input type="number" min={0} max={99} step="0.01" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} required className="h-9" /></label>
          <Button type="submit" size="sm" className="h-9" disabled={busy}>Salvar</Button>
        </form>
      )}
      {(rows.data ?? []).length > 0 && (
        <ul className="divide-y rounded-lg border">
          {rows.data!.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-20 tabular-nums">{r.valid_from.substring(0, 7).split("-").reverse().join("/")}</span>
              <span className="flex-1 text-muted-foreground tabular-nums">
                Impostos {formatPct(Number(r.tax_rate))} · Variáveis {formatPct(Number(r.variable_rate))} · Meta {formatPct(Number(r.margin_target))}
              </span>
              {canManage && <Button variant="ghost" size="sm" className="h-7" onClick={() => remove(r.id)}>Remover</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
