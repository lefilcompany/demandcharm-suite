import { useMemo, useState } from "react";
import { Calculator, Check, Download, FolderOpen, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinancePeople, type FinancePermission } from "@/hooks/useFinance";
import { useFinanceScenarios } from "@/hooks/useFinanceScenarios";
import { DEFAULT_MARGIN_TARGET, DEFAULT_TAX_RATE, costPerHour, formatBRL, formatPct } from "@/lib/finance/engine";
import { MAX_COMPARISON, scenarioCsv, simulatePricing, toggleComparison, validScenario, type Scenario, type ScenarioInputs } from "@/lib/finance/simulator";
import { MarginRuler } from "./MarginRuler";
import { OpsLabel } from "@/components/ops/OpsParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Draft = ScenarioInputs & { name: string; client_label: string; board_id: string; competence: string };
type PersonPlan = { userId: string; hours: number; rate: number };
type Props = { teamId: string; boards: { id: string; name: string }[]; can: (p: FinancePermission, boardId?: string) => boolean; isLoading: boolean };

const blank = (boardId: string): Draft => ({ name: "", client_label: "", board_id: boardId, competence: new Date().toISOString().substring(0, 7) + "-01", gross: 0, tax_rate: DEFAULT_TAX_RATE, variable_rate: 0, margin_target: DEFAULT_MARGIN_TARGET, team_cost: 0, planned_hours: 0, direct_expenses: 0, shared_costs: 0 });

function Numeric({ label, value, onChange, percent = false, max }: { label: string; value: number; onChange: (v: number) => void; percent?: boolean; max?: number }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-xs text-muted-foreground">{label}</span>
    <Input aria-label={label} type="number" inputMode="decimal" min={0} max={max ?? (percent ? 100 : undefined)} step={percent ? "0.1" : "0.01"} value={Number.isFinite(value) ? Number((value * (percent ? 100 : 1)).toFixed(6)) : ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value) / (percent ? 100 : 1))} className="h-9 tabular-nums" />
  </label>;
}

export function PricingSimulator({ teamId, boards, can, isLoading }: Props) {
  const { toast } = useToast();
  const scenarios = useFinanceScenarios(teamId, true);
  const [draft, setDraft] = useState<Draft>(() => blank(boards[0]?.id ?? ""));
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState("");
  const [personHours, setPersonHours] = useState(0);
  const [personPlans, setPersonPlans] = useState<PersonPlan[]>([]);
  const [costMode, setCostMode] = useState(false);
  const boardId = draft.board_id || boards[0]?.id || "";
  const canCosts = can("finance.view_employee_costs");
  const people = useFinancePeople(teamId, draft.competence, draft.competence, canCosts);
  const availablePeople = useMemo(() => {
    const map = new Map<string, { id: string; name: string; rate: number }>();
    for (const p of people.data ?? []) {
      if (!p.user_id || p.monthly_cost === null || p.productive_hours === null) continue;
      const rate = costPerHour(p.monthly_cost, p.productive_hours);
      if (rate !== null) map.set(p.user_id, { id: p.user_id, name: p.full_name ?? "Colaborador", rate });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people.data]);
  const result = simulatePricing(draft);
  const valid = validScenario(draft);
  const canSave = !!boardId && boards.some((b) => b.id === boardId) && can("finance.manage_revenue", boardId);
  const compared = (scenarios.data ?? []).filter((s) => selected.includes(s.id));
  const canExport = compared.length > 0 && compared.every((s) => can("finance.export", s.board_id));
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((s) => ({ ...s, [key]: value }));
  const fail = (message: string) => toast({ title: message, description: "Confira sua conexão e suas permissões e tente novamente.", variant: "destructive" });

  const save = async () => {
    if (!canSave || !valid || !draft.name.trim() || busy) return;
    setBusy(true);
    try {
      const payload = { ...draft, name: draft.name.trim(), board_id: boardId, team_id: teamId };
      const response = editing
        ? await supabase.from("finance_scenarios").update(payload).eq("id", editing).eq("team_id", teamId).select("id").single()
        : await supabase.from("finance_scenarios").insert(payload).select("id").single();
      if (response.error) throw response.error;
      setEditing(response.data.id);
      await scenarios.refetch();
      toast({ title: "Cenário salvo", description: "Os lançamentos reais não foram alterados." });
    } catch { fail("Não foi possível salvar o cenário"); }
    finally { setBusy(false); }
  };

  const open = (s: Scenario) => {
    setDraft({ name: s.name, client_label: s.client_label, board_id: s.board_id, competence: s.competence.substring(0, 10), gross: s.gross,
      tax_rate: s.tax_rate, variable_rate: s.variable_rate, margin_target: s.margin_target, team_cost: s.team_cost,
      planned_hours: s.planned_hours, direct_expenses: s.direct_expenses, shared_costs: s.shared_costs });
    setEditing(s.id); setPersonPlans([]); setCostMode(false);
  };
  const reset = () => { setDraft(blank(boardId)); setEditing(null); setPersonPlans([]); setCostMode(false); };
  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("finance_scenarios").delete().eq("id", deleting.id).eq("team_id", teamId).select("id").single();
      if (error) throw error;
      if (editing === deleting.id) reset();
      setSelected((ids) => ids.filter((id) => id !== deleting.id));
      setDeleting(null); await scenarios.refetch(); toast({ title: "Cenário excluído" });
    } catch { fail("Não foi possível excluir o cenário"); }
    finally { setBusy(false); }
  };
  const exportSelected = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("export_finance_scenarios", { _team_id: teamId, _ids: compared.map((s) => s.id) });
      if (error) throw error;
      const saved = data as unknown as (Scenario & { board_name: string })[];
      const url = URL.createObjectURL(new Blob([scenarioCsv(saved)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "cenarios-precificacao.csv"; a.click(); URL.revokeObjectURL(url);
    } catch { fail("Não foi possível exportar os cenários"); }
    finally { setBusy(false); }
  };
  const applyPlans = (plans: PersonPlan[]) => {
    setPersonPlans(plans);
    setDraft((d) => ({ ...d, team_cost: plans.reduce((sum, p) => sum + p.hours * p.rate, 0), planned_hours: plans.reduce((sum, p) => sum + p.hours, 0) }));
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!boards.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum quadro autorizado para simulação.</p>;

  return <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <form className="min-w-0 space-y-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="flex items-center justify-between border-b pb-3 gap-2"><div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /><h2 className="font-medium">{editing ? "Cenário salvo" : "Nova simulação"}</h2></div>
          <Button type="button" variant="ghost" size="sm" onClick={reset}><Plus className="mr-1.5 h-4 w-4" />Novo</Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-muted-foreground">Nome do cenário<Input aria-label="Nome do cenário" value={draft.name} maxLength={160} required onChange={(e) => update("name", e.target.value)} className="h-9" /></label>
          <label className="space-y-1.5 text-xs text-muted-foreground">Cliente / proposta<Input aria-label="Cliente / proposta" value={draft.client_label} maxLength={160} onChange={(e) => update("client_label", e.target.value)} className="h-9" /></label>
          <div className="space-y-1.5"><span className="text-xs text-muted-foreground">Quadro / projeto</span><Select value={boardId} disabled={!!editing} onValueChange={(v) => update("board_id", v)}><SelectTrigger aria-label="Quadro do cenário" className="h-9"><SelectValue /></SelectTrigger><SelectContent>{boards.map((b) => <SelectItem value={b.id} key={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          <label className="space-y-1.5 text-xs text-muted-foreground">Competência<Input aria-label="Competência do cenário" type="month" required value={draft.competence.substring(0, 7)} onChange={(e) => { update("competence", `${e.target.value}-01`); setPerson(""); }} className="h-9" /></label>
        </div>
        <section className="space-y-3 border-t pt-4"><OpsLabel>01 · Receita e meta</OpsLabel><div className="grid gap-3 sm:grid-cols-2">
          <Numeric label="Receita estimada (R$)" value={draft.gross} onChange={(v) => update("gross", v)} />
          <Numeric label="Impostos (%)" percent value={draft.tax_rate} onChange={(v) => update("tax_rate", v)} />
          <Numeric label="Custos variáveis sobre receita (%)" percent value={draft.variable_rate} onChange={(v) => update("variable_rate", v)} />
          <Numeric label="Meta de margem (%)" percent value={draft.margin_target} onChange={(v) => update("margin_target", v)} />
        </div></section>
        <section className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><OpsLabel>02 · Equipe</OpsLabel>
          {canCosts && <Button type="button" size="sm" variant={costMode ? "secondary" : "ghost"} onClick={() => { setCostMode(!costMode); setPersonPlans([]); }}><Users className="mr-1.5 h-4 w-4" />Custos cadastrados</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><Numeric label="Horas previstas" value={draft.planned_hours} onChange={(v) => { update("planned_hours", v); setPersonPlans([]); }} /><Numeric label="Custo estimado da equipe (R$)" value={draft.team_cost} onChange={(v) => { update("team_cost", v); setPersonPlans([]); }} /></div>
          {canCosts && costMode && <div className="border-l-2 border-primary pl-3 space-y-3">
            {people.isError ? <Button type="button" variant="outline" size="sm" onClick={() => people.refetch()}><RefreshCw className="mr-1 h-3 w-3" />Tentar carregar custos novamente</Button>
              : people.isLoading ? <Skeleton className="h-9 w-full" /> : availablePeople.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum custo individual cadastrado nesta competência.</p> : <>
                <div className="flex flex-wrap items-end gap-2"><div className="flex-1 min-w-[150px]"><Select value={person} onValueChange={setPerson}><SelectTrigger aria-label="Colaborador para simulação" className="h-9"><SelectValue placeholder="Colaborador" /></SelectTrigger><SelectContent>{availablePeople.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatBRL(p.rate)}/h</SelectItem>)}</SelectContent></Select></div>
                  <div className="w-28"><Numeric label="Horas da pessoa" value={personHours} onChange={setPersonHours} /></div>
                  <Button type="button" variant="outline" size="icon" aria-label="Adicionar horas à equipe" disabled={!person || personHours <= 0 || !Number.isFinite(personHours)} onClick={() => { const p = availablePeople.find((v) => v.id === person); if (p) applyPlans([...personPlans, { userId: p.id, hours: personHours, rate: p.rate }]); }}><Plus className="h-4 w-4" /></Button>
                </div>
                <ul className="divide-y text-xs">{personPlans.map((p, idx) => <li key={idx} className="flex items-center justify-between py-1 gap-2"><span className="truncate">{availablePeople.find((v) => v.id === p.userId)?.name ?? "Colaborador"} · {p.hours} h × {formatBRL(p.rate)}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Remover horas da pessoa" onClick={() => applyPlans(personPlans.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button></li>)}</ul>
              </>}
          </div>}
        </section>
        <section className="space-y-3 border-t pt-4"><OpsLabel>03 · Despesas</OpsLabel><div className="grid gap-3 sm:grid-cols-2"><Numeric label="Despesas diretas (R$)" value={draft.direct_expenses} onChange={(v) => update("direct_expenses", v)} /><Numeric label="Custos compartilhados (R$)" value={draft.shared_costs} onChange={(v) => update("shared_costs", v)} /></div></section>
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={!canSave || !valid || busy || !draft.name.trim()}><Save className="mr-2 h-4 w-4" />{busy ? "Aguarde…" : editing ? "Salvar alterações" : "Salvar cenário"}</Button>
          {!canSave && <span className="text-xs text-muted-foreground">Salvar exige permissão de lançamento de faturamento neste quadro.</span>}</div>
      </form>

      <aside className="min-w-0 space-y-4 self-start xl:sticky xl:top-4">
        <section className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
          <div className="p-5 border-b border-ops-ink-foreground/15"><OpsLabel>Preço mínimo · meta de {formatPct(draft.margin_target)}</OpsLabel><p className="mt-2 font-ops-display text-4xl tabular-nums font-semibold break-words">{valid && result.minimum !== null ? formatBRL(result.minimum) : "Indisponível"}</p></div>
          <div className="px-5 py-4"><OpsLabel>Margem estimada</OpsLabel><p className={cn("font-ops-display text-3xl font-semibold tabular-nums", result.result < 0 && "text-destructive")}>{valid ? formatPct(result.margin) : "—"}</p><div className="mt-2 [&_*]:!text-ops-ink-foreground/70"><MarginRuler margin={valid ? result.margin : null} target={draft.margin_target} /></div></div>
        </section>
        {!valid ? <p role="alert" className="text-sm text-destructive">Confira os valores: use números positivos e percentuais entre 0 e 100.</p> : result.minimum === null && <p role="alert" className="text-sm text-destructive border-l-2 border-destructive pl-3">Impostos, custos variáveis e meta somam 100% ou mais. Não há preço mínimo viável com essas premissas.</p>}
        <dl className="divide-y text-sm">{[["Receita líquida", result.netRevenue], ["Custo da equipe", draft.team_cost], ["Custos variáveis", result.variableCost], ["Despesas diretas", draft.direct_expenses], ["Custos compartilhados", draft.shared_costs], ["Custo total", result.totalCost], ["Resultado estimado", result.result]].map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">{label}</dt><dd className={cn("tabular-nums font-medium text-right", label === "Resultado estimado" && result.result < 0 && "text-destructive")}>{valid ? formatBRL(Number(value)) : "—"}</dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">Estimativa · alíquota e meta sujeitas à validação financeira.</p>
      </aside>
    </div>

    <section className="border-t pt-5 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium">Cenários salvos</h2><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{compared.length}/{MAX_COMPARISON} em comparação</span>{canExport && <Button variant="outline" size="sm" onClick={exportSelected} disabled={busy}><Download className="mr-1.5 h-4 w-4" />CSV dos cenários</Button>}</div></div>
      {scenarios.isLoading ? <Skeleton className="h-28 w-full" /> : scenarios.isError ? <div className="space-y-2 py-4"><p className="text-sm">Não foi possível carregar os cenários salvos.</p><Button variant="outline" size="sm" onClick={() => scenarios.refetch()}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button></div> : !scenarios.data?.length ? <p className="py-5 text-sm text-muted-foreground">Nenhum cenário salvo nesta equipe.</p> : <ul className="divide-y">{scenarios.data.map((s) => {
        const r = simulatePricing(s);
        return <li key={s.id} className={cn("flex flex-wrap items-center gap-3 py-3", editing === s.id && "bg-muted/40")}>
          <Checkbox aria-label={`Comparar ${s.name}`} checked={selected.includes(s.id)} disabled={!selected.includes(s.id) && selected.length >= MAX_COMPARISON} onCheckedChange={() => setSelected((ids) => toggleComparison(ids, s.id))} />
          <div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{s.name}</div><p className="text-xs text-muted-foreground truncate">{boards.find((b) => b.id === s.board_id)?.name ?? "Quadro"} · {s.competence.substring(5, 7)}/{s.competence.substring(0, 4)}{s.client_label ? ` · ${s.client_label}` : ""}</p></div>
          <span className="font-ops-label text-xs tabular-nums">{formatPct(r.margin)}</span>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={`Abrir ${s.name}`} onClick={() => open(s)}><FolderOpen className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Abrir e renomear cenário</TooltipContent></Tooltip>
          {can("finance.manage_revenue", s.board_id) && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={`Excluir ${s.name}`} onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Excluir cenário</TooltipContent></Tooltip>}
        </li>;
      })}</ul>}
    </section>

    {compared.length > 0 && <section className="space-y-3 border-t pt-5"><h2 className="font-medium flex items-center gap-2"><Check className="h-4 w-4 text-primary" />Comparação</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3 pr-4 font-normal text-muted-foreground">Indicador</th>{compared.map((s) => <th key={s.id} className="min-w-[170px] max-w-[240px] py-3 px-4 text-right font-medium break-words">{s.name}</th>)}</tr></thead><tbody className="divide-y">{["Receita estimada", "Impostos", "Custo da equipe", "Horas previstas", "Despesas diretas", "Custos compartilhados", "Custos variáveis", "Receita líquida", "Custo total", "Resultado", "Margem", "Meta", "Preço mínimo"].map((label, idx) => <tr key={label}><td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{label}</td>{compared.map((s) => {
      const r = simulatePricing(s);
      const values = [formatBRL(s.gross), formatBRL(r.tax), formatBRL(s.team_cost), `${s.planned_hours.toLocaleString("pt-BR")} h`, formatBRL(s.direct_expenses), formatBRL(s.shared_costs), formatBRL(r.variableCost), formatBRL(r.netRevenue), formatBRL(r.totalCost), formatBRL(r.result), formatPct(r.margin), formatPct(s.margin_target), r.minimum === null ? "Indisponível" : formatBRL(r.minimum)];
      return <td key={s.id} className={cn("py-2.5 px-4 text-right tabular-nums whitespace-nowrap", idx === 12 && "font-semibold text-primary")}>{values[idx]}</td>;
    })}</tr>)}</tbody></table></div></section>}

    <AlertDialog open={!!deleting} onOpenChange={(v) => !v && !busy && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir cenário?</AlertDialogTitle><AlertDialogDescription>O cenário “{deleting?.name}” será excluído. Os lançamentos financeiros reais não serão alterados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void remove(); }}>Excluir cenário</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}