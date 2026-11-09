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

export function ProjectFinanceSummary({ projectId, month, onMonth }: { projectId: string; month: string; onMonth: (m: string) => void }) {
  const q = useProjectFinanceOverview(projectId, month);
  if (q.isError && String((q.error as any)?.message).includes("FORBIDDEN"))
    return <p className="text-sm text-muted-foreground">Você ainda não tem acesso aos números deste projeto. O dono da equipe pode liberar em Configurações da equipe.</p>;
  const r = q.data && q.data.length ? projectResult(q.data) : null;
  const m0 = q.data?.[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium flex-1">Resultado do projeto</h3>
        {m0 && m0.period_status !== "open" && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{m0.has_adjustments ? "Fechado + ajustes" : "Mês fechado"}</span>}
        <Input type="month" aria-label="Mês do resultado" value={month} onChange={(e) => e.target.value && onMonth(e.target.value)} className="h-8 w-40" />
      </div>
      {q.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />Não foi possível carregar o resultado.
          <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => q.refetch()}><RotateCw className="h-3.5 w-3.5 mr-1" />Tentar de novo</Button>
        </div>
      ) : !r || !m0 ? <Skeleton className="h-28 w-full rounded-xl" /> : (
        <section aria-label="Resultado do projeto" className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4">
            <Cell label="Faturamento" value={formatBRL(r.gross)} note={`Impostos ${formatBRL(r.tax)} · ${formatPct(Number(m0.tax_rate))}`} />
            <Cell label="Custo total" value={formatBRL(r.totalCost + r.totals.variable)} note={`Pessoal ${formatBRL(r.totals.teamCost)} · ${fmtHours(r.totals.hours)}`}
              warn={r.totals.hoursWithoutCost > 0} />
            <Cell label="Resultado" value={formatBRL(r.result)} note={STATUS_LABEL[r.status]} warn={r.result < 0} />
            <Cell label="Margem" value={r.margin == null ? "—" : formatPct(r.margin)} note={`Meta ${formatPct(r.totals.marginTarget)}`} />
          </div>
          <div className="px-4 pb-4 pt-1"><MarginRuler margin={r.margin} target={r.totals.marginTarget} compact /></div>
          {r.totals.hoursWithoutCost > 0 && (
            <p className="px-4 pb-3 text-xs text-primary">Custo incompleto: {fmtHours(r.totals.hoursWithoutCost)} de pessoas sem custo cadastrado no mês.</p>
          )}
          {m0.board_ids.length === 0 && <p className="px-4 pb-3 text-xs text-ops-ink-foreground/70">Nenhum quadro vinculado neste mês.</p>}
        </section>
      )}
      {m0?.adjustments && m0.adjustments.length > 0 && (
        <div className="rounded-lg border text-sm">
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">Ajustes depois do fechamento</p>
          <ul className="divide-y">
            {m0.adjustments.map((a) => (
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
