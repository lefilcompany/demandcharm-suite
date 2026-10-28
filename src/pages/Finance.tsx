import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Download, Info, Lock, RefreshCw } from "lucide-react";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useBoards } from "@/hooks/useBoards";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useFinanceAccess, useFinanceOverview, useFinanceAllocation, useFinancePeople, OverviewRow } from "@/hooks/useFinance";
import { CostsProductivity } from "@/components/finance/CostsProductivity";
import { ExpensesAllocation } from "@/components/finance/ExpensesAllocation";
import { PricingSimulator } from "@/components/finance/PricingSimulator";
import { MonthlyClosing } from "@/components/finance/MonthlyClosing";
import { computeFinance, FinanceResult, formatBRL, formatPct, STATUS_LABEL } from "@/lib/finance/engine";
import { OpsLabel } from "@/components/ops/OpsParts";
import { MonthRangeField } from "@/components/ops/MonthRangeField";

import { MarginRuler, DeviationTag } from "@/components/finance/MarginRuler";
import { FinanceManage } from "@/components/finance/FinanceManage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Agg = FinanceResult & { boardId: string; name: string; teamCost: number; directExpenses: number; allocated: number; hoursRealized: number; hoursPlanned: number; hoursWithoutCost: number; target: number };

function aggregate(rows: OverviewRow[]): Agg {
  const s = rows.reduce((a, r) => ({
    gross: a.gross + r.gross, tax: a.tax + r.tax, teamCost: a.teamCost + r.team_cost, directExpenses: a.directExpenses + r.direct_expenses, allocated: a.allocated + r.allocated_expenses,
    hoursRealized: a.hoursRealized + r.hours_realized, hoursPlanned: a.hoursPlanned + r.hours_planned, hoursWithoutCost: a.hoursWithoutCost + r.hours_without_cost,
  }), { gross: 0, tax: 0, teamCost: 0, directExpenses: 0, allocated: 0, hoursRealized: 0, hoursPlanned: 0, hoursWithoutCost: 0 });
  const target = rows[0]?.margin_target ?? 0.4;
  return { ...computeFinance({ ...s, operationalAlloc: s.allocated, marginTarget: target }), ...s, boardId: rows[0]?.board_id ?? "", name: rows[0]?.board_name ?? "", target };
}

const STATUS_TONE: Record<string, string> = {
  rentavel: "text-foreground border-foreground/30",
  atencao: "text-primary border-primary/50",
  prejuizo: "text-destructive border-destructive/50",
  sem_dados: "text-muted-foreground border-border",
};

const hint = (t: string) => (
  <Tooltip><TooltipTrigger asChild><button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Explicação"><Info className="h-3 w-3" /></button></TooltipTrigger>
    <TooltipContent className="max-w-xs">{t}</TooltipContent></Tooltip>
);

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

export default function Finance({ teamId: forcedTeamId, teamName }: { teamId?: string | null; teamName?: string } = {}) {
  const ctx = useSelectedTeam();
  const selectedTeamId = forcedTeamId !== undefined ? forcedTeamId : ctx.selectedTeamId;
  const currentTeam = forcedTeamId !== undefined ? { name: teamName } : ctx.currentTeam;
  const fin = useFinanceAccess(selectedTeamId);
  const { data: memberBoards = [] } = useBoards(forcedTeamId !== undefined ? null : selectedTeamId);
  const { data: members = [] } = useTeamMembers(selectedTeamId);
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().substring(0, 7);
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(now.toISOString().substring(0, 7));
  const [boardFilter, setBoardFilter] = useState("all");
  const [detail, setDetail] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: keyof Agg; dir: 1 | -1 }>({ key: "result", dir: -1 });

  const canView = fin.canAny("finance.view_board") || fin.canAny("finance.view_team");
  const lastDay = new Date(Number(to.substring(0, 4)), Number(to.substring(5, 7)), 0).getDate();
  const ov = useFinanceOverview(selectedTeamId, `${from}-01`, `${to}-${String(lastDay).padStart(2, "0")}`, canView && from <= to);

  const boards = useMemo(() => {
    if (forcedTeamId === undefined) return memberBoards as { id: string; name: string }[];
    const m = new Map<string, string>();
    (ov.data ?? []).forEach((r) => m.set(r.board_id, r.board_name));
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [forcedTeamId, memberBoards, ov.data]);
  const range = [`${from}-01`, `${to}-${String(lastDay).padStart(2, "0")}`] as const;
  const alloc = useFinanceAllocation(selectedTeamId, range[0], range[1], canView && from <= to);
  const people = useFinancePeople(selectedTeamId, range[0], range[1], canView && from <= to);
  const boardOrder = useMemo(() => [...new Set((ov.data ?? []).map((r) => r.board_id))], [ov.data]);
  const rows = useMemo(() => (ov.data ?? []).filter((r) => boardFilter === "all" || r.board_id === boardFilter), [ov.data, boardFilter]);
  const perBoard = useMemo(() => {
    const m = new Map<string, OverviewRow[]>();
    rows.forEach((r) => m.set(r.board_id, [...(m.get(r.board_id) ?? []), r]));
    return [...m.values()].map(aggregate);
  }, [rows]);
  const total = useMemo(() => aggregate(rows), [rows]);
  const months = useMemo(() => {
    const m = new Map<string, OverviewRow[]>();
    rows.forEach((r) => m.set(r.competence, [...(m.get(r.competence) ?? []), r]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const a = aggregate(v);
      return { month: monthLabel(k), Faturamento: a.gross, Custos: a.totalCost + a.tax, Resultado: a.result };
    });
  }, [rows]);
  const sorted = useMemo(() => [...perBoard].sort((a, b) => {
    const av = a[sort.key] as any, bv = b[sort.key] as any;
    return ((av ?? -Infinity) > (bv ?? -Infinity) ? 1 : (av ?? -Infinity) < (bv ?? -Infinity) ? -1 : 0) * sort.dir;
  }), [perBoard, sort]);
  const belowTarget = perBoard.filter((b) => b.status === "atencao" || b.status === "prejuizo");
  const authorizedBoards = boards.filter((b) => (ov.data ?? []).some((r) => r.board_id === b.id));
  const canManage = fin.canAny("finance.manage_revenue") || fin.canAny("finance.manage_expenses") || fin.can("finance.view_employee_costs") || fin.can("finance.manage_settings");
  const canExport = fin.canAny("finance.export");

  const exportCsv = () => {
    const head = ["Quadro", "Faturamento bruto", "Impostos", "Receita líquida", "Horas previstas", "Horas realizadas", "Custo da equipe", "Despesas diretas", "Rateio", "Custo total", "Resultado", "Margem", "Meta", "Desvio p.p.", "Status"];
    const lines = sorted.filter((b) => fin.can("finance.export", b.boardId)).map((b) => [b.name, b.gross, b.tax, b.netRevenue, b.hoursPlanned, b.hoursRealized, b.teamCost, b.directExpenses, b.allocated, b.totalCost, b.result,
      b.margin === null ? "" : (b.margin * 100).toFixed(1), (b.target * 100).toFixed(1), b.deviationPp === null ? "" : b.deviationPp.toFixed(1), STATUS_LABEL[b.status]]
      .map((v) => typeof v === "number" ? v.toFixed(2).replace(".", ",") : `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rentabilidade-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (fin.isLoading) return <div className="p-6 space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!fin.hasModule) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Sem acesso à Inteligência Financeira</h1>
          <p className="text-sm text-muted-foreground">Os números financeiros são liberados pessoa a pessoa. Peça ao dono da equipe com permissão de configuração para liberar seu acesso.</p>
          <Button asChild variant="outline"><Link to="/app">Voltar ao dashboard</Link></Button>
        </div>
      </div>
    );
  }

  const memberList = members.map((m: any) => ({ user_id: m.user_id, name: m.profile?.full_name ?? "Usuário" }));
  const isOwnerOrAdmin = !!fin.access?.is_global_admin || !!fin.access?.is_team_owner;
  const detailRow = perBoard.find((b) => b.boardId === detail);
  const detailAlloc = (alloc.data ?? []).filter((a) => a.board_id === detail);
  const detailMonths = (ov.data ?? []).filter((r) => r.board_id === detail).sort((a, b) => a.competence.localeCompare(b.competence));

  const Th = ({ k, children, right = true }: { k: keyof Agg; children: React.ReactNode; right?: boolean }) => (
    <th className={cn("px-3 py-2 font-normal whitespace-nowrap", right && "text-right")}>
      <button className="inline-flex items-center gap-1 font-ops-label text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {children}{sort.key === k && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto w-full">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <OpsLabel>{currentTeam?.name ?? "Equipe"} · cada quadro é um projeto</OpsLabel>
          <h1 className="text-xl md:text-2xl font-semibold">Inteligência Financeira</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <OpsLabel>Período</OpsLabel>
            <MonthRangeField from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          </div>

          <div className="space-y-1"><OpsLabel>Quadro</OpsLabel>
            <Select value={boardFilter} onValueChange={setBoardFilter}><SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos autorizados</SelectItem>{authorizedBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          {canExport && <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv} disabled={!sorted.length}><Download className="h-4 w-4" />CSV</Button>}
        </div>
      </header>

      <Tabs defaultValue={canView ? "overview" : fin.can("finance.close_period") ? "closing" : "manage"}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {canView && <TabsTrigger value="overview">Visão Geral</TabsTrigger>}
          {canView && <TabsTrigger value="projects">Rentabilidade por Projeto</TabsTrigger>}
          {canView && <TabsTrigger value="people">Custos e Produtividade</TabsTrigger>}
          {canView && <TabsTrigger value="allocation">Despesas e Rateios</TabsTrigger>}
          {canView && <TabsTrigger value="simulator">Simulador de Precificação</TabsTrigger>}
          {(canView || fin.can("finance.close_period")) && <TabsTrigger value="closing">Fechamento</TabsTrigger>}
          {canManage && <TabsTrigger value="manage">Lançamentos e acesso</TabsTrigger>}
        </TabsList>

        {canView && ov.isError && (
          <div className="mt-4 rounded-xl border p-6 text-center space-y-2">
            <p className="text-sm">Não foi possível carregar os números financeiros.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => ov.refetch()}><RefreshCw className="h-4 w-4" />Tentar de novo</Button>
          </div>
        )}

        {canView && !ov.isError && (
          <TabsContent value="overview" className="space-y-4">
            {/* Ledger strip: the P&L read top to bottom */}
            <section className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {[
                  { l: "Faturamento bruto", v: formatBRL(total.gross), h: "Soma do faturado nos quadros autorizados no período." },
                  { l: "− Impostos", v: formatBRL(total.tax), h: "Faturamento × alíquota (padrão 21%, ou a do lançamento/quadro)." },
                  { l: "= Receita líquida", v: formatBRL(total.netRevenue), h: "Faturamento bruto menos impostos." },
                  { l: "− Custo total", v: formatBRL(total.totalCost), h: "Custo das horas apontadas + despesas diretas + rateio das despesas compartilhadas." },
                  { l: "= Resultado", v: formatBRL(total.result), h: "Receita líquida menos custo total.", tone: total.result < 0 ? "text-destructive" : "" },
                  { l: "Margem", v: formatPct(total.margin), h: "Resultado ÷ faturamento bruto. Indisponível quando não há faturamento." },
                ].map((m) => (
                  <div key={m.l} className="px-4 py-3 sm:px-5 border-ops-ink-foreground/10 border-b xl:border-b-0 [&:not(:first-child)]:xl:border-l">
                    <div className="flex items-center gap-1.5"><OpsLabel>{m.l}</OpsLabel>{hint(m.h)}</div>
                    {ov.isLoading ? <Skeleton className="mt-1 h-8 w-24 bg-ops-ink-foreground/10" /> :
                      <div className={cn("font-ops-display text-2xl sm:text-3xl font-semibold tabular-nums leading-tight", m.tone)}>{m.v}</div>}
                  </div>
                ))}
              </div>
              <div className="px-4 sm:px-5 pb-3 pt-2 [&_*]:!text-ops-ink-foreground/70">
                <MarginRuler margin={total.margin} target={total.target} />
              </div>
            </section>

            {total.hoursWithoutCost > 0 && (
              <p className="text-sm rounded-lg border border-primary/40 px-3 py-2">
                {hrs(total.hoursWithoutCost)} apontadas por pessoas sem custo cadastrado no mês. O custo da equipe está subestimado até que esses custos sejam lançados.
              </p>
            )}

            <div className="grid gap-4 2xl:grid-cols-[3fr_2fr]">
              <section className="rounded-xl border bg-card p-4">
                <OpsLabel>Evolução mensal</OpsLabel>
                <div className="h-64 mt-2">
                  {ov.isLoading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={months}>
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
                        <RTooltip formatter={(v: number) => formatBRL(v)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Faturamento" fill="hsl(var(--plan-5))" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Custos" fill="hsl(var(--plan-3))" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Resultado" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between"><OpsLabel>Margem por projeto</OpsLabel><OpsLabel>{belowTarget.length} abaixo da meta</OpsLabel></div>
                {ov.isLoading ? <Skeleton className="h-40 w-full" /> : perBoard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum quadro liberado para você no período.</p>
                ) : (
                  <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {[...perBoard].sort((a, b) => (b.margin ?? -9) - (a.margin ?? -9)).map((b) => (
                      <li key={b.boardId}>
                        <button className="w-full text-left space-y-1 rounded-md p-1 -m-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDetail(b.boardId)}>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{b.name}</span>
                            <span className="flex items-center gap-2 shrink-0"><span className="tabular-nums">{formatPct(b.margin)}</span><DeviationTag margin={b.margin} target={b.target} /></span>
                          </div>
                          <MarginRuler margin={b.margin} target={b.target} compact />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="rounded-xl border bg-card p-4">
              <OpsLabel>Horas previstas × realizadas</OpsLabel>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {perBoard.map((b) => {
                  const ratio = b.hoursPlanned > 0 ? b.hoursRealized / b.hoursPlanned : null;
                  return (
                    <div key={b.boardId} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="truncate">{b.name}</span>
                      <span className={cn("font-ops-label text-xs tabular-nums shrink-0", ratio !== null && ratio > 1 && "text-primary")}>
                        {hrs(b.hoursRealized)} / {b.hoursPlanned ? hrs(b.hoursPlanned) : "sem previsão"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>
        )}

        {canView && !ov.isError && (
          <TabsContent value="projects">
            <div className="rounded-xl border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <Th k="name" right={false}>Projeto</Th><Th k="gross">Bruto</Th><Th k="tax">Impostos</Th><Th k="netRevenue">Líquida</Th>
                    <Th k="hoursPlanned">H. prev.</Th><Th k="hoursRealized">H. real.</Th><Th k="teamCost">Equipe</Th><Th k="directExpenses">Diretas</Th><Th k="allocated">Rateio</Th>
                    <Th k="totalCost">Custo total</Th><Th k="result">Resultado</Th><Th k="margin">Margem</Th><Th k="deviationPp">Desvio</Th><Th k="status">Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ov.isLoading && <tr><td colSpan={14} className="p-4"><Skeleton className="h-24 w-full" /></td></tr>}
                  {!ov.isLoading && sorted.length === 0 && <tr><td colSpan={14} className="p-6 text-center text-muted-foreground">Nenhum quadro liberado para você no período.</td></tr>}
                  {sorted.map((b) => (
                    <tr key={b.boardId} className="hover:bg-muted/40 cursor-pointer" onClick={() => setDetail(b.boardId)}>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{b.name}</td>
                      {[b.gross, b.tax, b.netRevenue].map((v, i) => <td key={i} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(v)}</td>)}
                      <td className="px-3 py-2 text-right tabular-nums">{hrs(b.hoursPlanned)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{hrs(b.hoursRealized)}</td>
                      {[b.teamCost, b.directExpenses, b.allocated, b.totalCost].map((v, i) => <td key={i} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(v)}</td>)}
                      <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium", b.result < 0 && "text-destructive")}>{formatBRL(b.result)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatPct(b.margin)}</td>
                      <td className="px-3 py-2 text-right"><DeviationTag margin={b.margin} target={b.target} /></td>
                      <td className="px-3 py-2 text-right"><span className={cn("inline-block rounded-md border px-2 py-0.5 text-xs whitespace-nowrap", STATUS_TONE[b.status])}>{STATUS_LABEL[b.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}

        {canView && (
          <TabsContent value="people">
            <CostsProductivity rows={people.data ?? []} detailed={fin.can("finance.view_employee_costs")} isLoading={people.isLoading} isError={people.isError} onRetry={() => people.refetch()} boardOrder={boardOrder} />
          </TabsContent>
        )}
        {canView && (
          <TabsContent value="allocation">
            <ExpensesAllocation rows={(alloc.data ?? []).filter((r) => boardFilter === "all" || !r.board_id || r.board_id === boardFilter)} isLoading={alloc.isLoading} isError={alloc.isError} onRetry={() => alloc.refetch()} boardOrder={boardOrder} />
          </TabsContent>
        )}

        {canView && selectedTeamId && (
          <TabsContent value="simulator">
            {ov.isError ? <p className="py-6 text-sm text-muted-foreground">Os quadros autorizados não puderam ser carregados. Tente novamente acima.</p> :
              <PricingSimulator key={selectedTeamId} teamId={selectedTeamId} boards={authorizedBoards} can={fin.can} isLoading={ov.isLoading} />}
          </TabsContent>
        )}

        {(canView || fin.can("finance.close_period")) && selectedTeamId && (
          <TabsContent value="closing">
            <MonthlyClosing teamId={selectedTeamId} boards={boards.map((b) => ({ id: b.id, name: b.name }))} members={memberList} can={fin.can} />
          </TabsContent>
        )}

        {canManage && selectedTeamId && (
          <TabsContent value="manage">
            <FinanceManage teamId={selectedTeamId} boards={boards.map((b) => ({ id: b.id, name: b.name }))} members={memberList} can={fin.can} canAny={fin.canAny} isOwnerOrAdmin={isOwnerOrAdmin} overview={ov.data ?? []} />
          </TabsContent>
        )}
      </Tabs>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailRow && (
            <>
              <SheetHeader><SheetTitle>{detailRow.name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs", STATUS_TONE[detailRow.status])}>{STATUS_LABEL[detailRow.status]}</span>
                  <DeviationTag margin={detailRow.margin} target={detailRow.target} />
                </div>
                <MarginRuler margin={detailRow.margin} target={detailRow.target} />
                <dl className="divide-y text-sm">
                  {[
                    ["Faturamento bruto", formatBRL(detailRow.gross)], ["Impostos", formatBRL(detailRow.tax)], ["Receita líquida", formatBRL(detailRow.netRevenue)],
                    ["Custo da equipe (agregado)", formatBRL(detailRow.teamCost)], ["Despesas diretas", formatBRL(detailRow.directExpenses)], ["Rateio recebido", formatBRL(detailRow.allocated)],
                    ["Margem de contribuição", formatBRL(detailRow.contributionMargin)], ["Resultado gerencial", formatBRL(detailRow.result)],
                    ["Horas previstas / realizadas", `${hrs(detailRow.hoursPlanned)} / ${hrs(detailRow.hoursRealized)}`],
                  ].map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums font-medium">{v}</dd></div>)}
                </dl>
                {detailAlloc.length > 0 && (
                  <div>
                    <OpsLabel>De onde veio o rateio</OpsLabel>
                    <ul className="mt-2 divide-y text-sm">
                      {detailAlloc.map((a) => (
                        <li key={a.expense_id} className="flex justify-between gap-3 py-2">
                          <span className="truncate">{a.description} <span className="text-muted-foreground">· {monthLabel(a.competence)} · {Math.round((a.share ?? 0) * 100)}%</span></span>
                          <span className="tabular-nums">{formatBRL(a.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <OpsLabel>Mês a mês</OpsLabel>
                  <ul className="mt-2 divide-y text-sm">
                    {detailMonths.map((r) => {
                      const c = computeFinance({ gross: r.gross, tax: r.tax, teamCost: r.team_cost, directExpenses: r.direct_expenses, operationalAlloc: r.allocated_expenses, marginTarget: r.margin_target });
                      return (
                        <li key={r.competence} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 py-2">
                          <span className="font-ops-label text-xs uppercase">{monthLabel(r.competence)}</span>
                          <MarginRuler margin={c.margin} target={r.margin_target} compact />
                          <span className={cn("tabular-nums text-right", c.result < 0 && "text-destructive")}>{formatBRL(c.result)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
