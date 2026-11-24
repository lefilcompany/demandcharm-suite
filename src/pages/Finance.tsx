import { generateProfitabilityPdf } from "@/lib/finance/profitabilityPdf";
import { useAuth } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FinanceNotice, FinanceSection } from "@/components/ops/FinanceUI";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Calculator, CalendarCheck, Info, LayoutDashboard, Lock, PieChart, RefreshCw, Receipt, Users, Wallet } from "lucide-react";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useBoards } from "@/hooks/useBoards";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useFinanceAccess, useFinanceOverview, useFinanceAllocation, useFinancePeople, OverviewRow } from "@/hooks/useFinance";
import { CostsProductivity } from "@/components/finance/CostsProductivity";
import { ExpensesAllocation } from "@/components/finance/ExpensesAllocation";
import { PricingSimulator } from "@/components/finance/PricingSimulator";
import { MonthlyClosing } from "@/components/finance/MonthlyClosing";
import { TeamProjectsFinance } from "@/components/finance/TeamProjectsFinance";
import { TeamRevenueTotal } from "@/components/finance/TeamRevenueTotal";
import { ExportReportButton } from "@/components/finance/ExportReportButton";
import { computeFinance, FinanceResult, formatBRL, formatPct, resultLegendTones, resultTone, STATUS_LABEL } from "@/lib/finance/engine";
import { OpsLabel } from "@/components/ops/OpsParts";
import { MonthRangeField } from "@/components/ops/MonthRangeField";

import { MarginRuler, DeviationTag } from "@/components/finance/MarginRuler";
import { FinanceManage } from "@/components/finance/FinanceManage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type Agg = FinanceResult & { boardId: string; name: string; teamCost: number; directExpenses: number; allocated: number; hoursRealized: number; hoursPlanned: number; hoursWithoutCost: number; target: number };

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
    <TooltipContent className="max-w-[15rem] text-xs leading-snug normal-case tracking-normal font-normal">{t}</TooltipContent></Tooltip>
);

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

/**
 * Legenda do gráfico de evolução mensal. O resultado muda de cor mês a mês
 * (vermelho = prejuízo, verde = lucro), então a legenda lista só as cores que
 * realmente aparecem nas barras — nunca um cinza que não existe no gráfico.
 */
function MonthlyLegend({ payload, resultTones }: { payload?: { value?: string; color?: string }[]; resultTones?: { label: string; color: string }[] }) {
  const base = (payload ?? []).filter((e) => e.value && e.value !== "Resultado").map((e) => ({ label: e.value as string, color: e.color ?? "hsl(var(--muted-foreground))" }));
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1 text-[11px] text-muted-foreground">
      {[...base, ...(resultTones ?? [])].map((e) => (
        <li key={e.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: e.color }} aria-hidden />
          <span>{e.label}</span>
        </li>
      ))}
    </ul>
  );
}

const SECTIONS = [
  { v: "overview", label: "Visão geral", hint: "Resultado consolidado da equipe", icon: LayoutDashboard },
  { v: "byProject", label: "Por projeto", hint: "Faturamento e resultado de cada projeto", icon: PieChart },
  { v: "people", label: "Pessoas", hint: "Custos e produtividade por pessoa", icon: Users },
  { v: "manage", label: "Custos", hint: "Custos gerais da equipe", icon: Wallet },
  { v: "simulator", label: "Simulador", hint: "Simulação de precificação", icon: Calculator },
] as const;
type SectionId = (typeof SECTIONS)[number]["v"];

export default function Finance({ teamId: forcedTeamId, teamName, boardScope }: { teamId?: string | null; teamName?: string; boardScope?: string[] } = {}) {
  const ctx = useSelectedTeam();
  const { user } = useAuth();
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
  const [params, setParams] = useSearchParams();
  const [detail, setDetail] = useState<string | null>(null);

  const canView = fin.canAny("finance.view_board") || fin.canAny("finance.view_team");
  const canManage = fin.canAny("finance.manage_revenue") || fin.canAny("finance.manage_expenses") || fin.can("finance.view_employee_costs") || fin.can("finance.manage_settings");
  const canExport = fin.canAny("finance.export");

  const sections = useMemo(() => SECTIONS.filter((s) => {
    if (s.v === "manage") return canManage || canView;
    return canView;
  }), [canView, canManage, fin]);

  const [active, setActive] = useState<SectionId>(() => {
    const p = params.get("aba");
    const mapped = p === "projects" ? "byProject" : p;
    return (SECTIONS.some((s) => s.v === mapped) ? mapped : "overview") as SectionId;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const jumping = useRef<number | null>(null);

  const computeActive = useCallback(() => {
    const root = scrollRef.current;
    if (!root || sections.length === 0) return;
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
      setActive(sections[sections.length - 1].v);
      return;
    }
    const top = root.getBoundingClientRect().top + 24;
    let current: SectionId = sections[0].v;
    for (const s of sections) {
      const el = sectionRefs.current[s.v];
      if (el && el.getBoundingClientRect().top <= top) current = s.v;
    }
    setActive(current);
  }, [sections]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => { if (jumping.current === null) computeActive(); };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [computeActive]);

  const jumpTo = (id: SectionId) => {
    const root = scrollRef.current;
    const el = sectionRefs.current[id];
    setActive(id);
    const n = new URLSearchParams(params);
    n.set("aba", id);
    setParams(n, { replace: true });
    if (!root || !el) return;
    const target = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 8;
    if (jumping.current) window.clearTimeout(jumping.current);
    jumping.current = window.setTimeout(() => { jumping.current = null; }, 700);
    root.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  };

  const lastDay = new Date(Number(to.substring(0, 4)), Number(to.substring(5, 7)), 0).getDate();
  const ov = useFinanceOverview(selectedTeamId, `${from}-01`, `${to}-${String(lastDay).padStart(2, "0")}`, canView && from <= to);
  const scopedOv = useMemo(() => (ov.data ?? []).filter((r) => !boardScope || boardScope.includes(r.board_id)), [ov.data, boardScope]);

  const boards = useMemo(() => {
    if (forcedTeamId === undefined) return memberBoards as { id: string; name: string }[];
    const m = new Map<string, string>();
    scopedOv.forEach((r) => m.set(r.board_id, r.board_name));
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [forcedTeamId, memberBoards, scopedOv]);
  const range = [`${from}-01`, `${to}-${String(lastDay).padStart(2, "0")}`] as const;
  const alloc = useFinanceAllocation(selectedTeamId, range[0], range[1], canView && from <= to);
  const people = useFinancePeople(selectedTeamId, range[0], range[1], canView && from <= to);
  const boardOrder = useMemo(() => [...new Set(scopedOv.map((r) => r.board_id))], [scopedOv]);
  const rows = useMemo(() => scopedOv.filter((r) => boardFilter === "all" || r.board_id === boardFilter), [scopedOv, boardFilter]);
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
  const resultLegend = useMemo(() => resultLegendTones(months.map((m) => m.Resultado)), [months]);
  const sorted = useMemo(() => [...perBoard].sort((a, b) => (b.result ?? 0) - (a.result ?? 0)), [perBoard]);
  const authorizedBoards = boards.filter((b) => scopedOv.some((r) => r.board_id === b.id));

  const buildCsv = () => {
    const head = ["Quadro", "Faturamento bruto", "Impostos", "Receita líquida", "Horas previstas", "Horas realizadas", "Custo da equipe", "Despesas diretas", "Rateio", "Custo total", "Resultado", "Margem", "Meta", "Desvio p.p.", "Status"];
    const lines = sorted.filter((b) => fin.can("finance.export", b.boardId)).map((b) => [b.name, b.gross, b.tax, b.netRevenue, b.hoursPlanned, b.hoursRealized, b.teamCost, b.directExpenses, b.allocated, b.totalCost, b.result,
      b.margin === null ? "" : (b.margin * 100).toFixed(1), (b.target * 100).toFixed(1), b.deviationPp === null ? "" : b.deviationPp.toFixed(1), STATUS_LABEL[b.status]]
      .map((v) => typeof v === "number" ? v.toFixed(2).replace(".", ",") : `"${String(v).replace(/"/g, '""')}"`).join(";"));
    return [head.join(";"), ...lines].join("\n");
  };
  const exportPdf = () => {
    const list = sorted.filter((b) => fin.can("finance.export", b.boardId));
    const me = members.find((m: any) => m.user_id === user?.id) as any;
    const ml = (k: string) => new Date(`${k}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    generateProfitabilityPdf({
      teamName: currentTeam?.name ?? "Equipe", periodLabel: from === to ? ml(from) : `${ml(from)} a ${ml(to)}`,
      scopeLabel: boardFilter === "all" ? "Todos os quadros autorizados" : (authorizedBoards.find((b) => b.id === boardFilter)?.name ?? "Quadro"),
      authorName: me?.profile?.full_name ?? user?.email ?? "—",
      total, months: months.map((m) => ({ month: m.month, gross: m.Faturamento, cost: m.Custos, result: m.Resultado })),
      boards: list.map((b) => ({ ...b, statusLabel: STATUS_LABEL[b.status] })),
      filename: `rentabilidade-${from}-a-${to}.pdf`,
    });
  };
  const exportCsv = () => {
    const blob = new Blob(["\ufeff" + buildCsv()], { type: "text/csv;charset=utf-8" });
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
  const detailMonths = scopedOv.filter((r) => r.board_id === detail).sort((a, b) => a.competence.localeCompare(b.competence));

  const renderSection = (v: SectionId) => {
    switch (v) {
      case "overview":
        return (
          <div className="space-y-4">
            {/* Ledger strip: the P&L read top to bottom */}
            <section className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
              <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                {/* Resultado em destaque */}
                <div className="px-5 py-5 sm:px-6 border-b lg:border-b-0 lg:border-r border-ops-ink-foreground/10 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-ops-ink-foreground/80"><span>Resultado do período</span></div>
                  {ov.isLoading ? <Skeleton className="mt-2 h-11 w-52 bg-ops-ink-foreground/10" /> : (
                    <div className={cn("mt-1 font-ops-display text-2xl sm:text-3xl xl:text-4xl 2xl:text-5xl font-semibold tabular-nums leading-tight whitespace-nowrap", resultTone(total.result))} title={formatBRL(total.result)}>
                      {formatBRL(total.result)}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-base text-ops-ink-foreground/80">
                    <span>Margem</span>
                    <span className={cn("font-ops-display text-xl font-semibold tabular-nums", resultTone(total.result))}>{formatPct(total.margin)}</span>
                    {hint("Resultado ÷ faturamento bruto. Indisponível quando não há faturamento.")}
                  </div>
                </div>
                {/* Composição: entradas e saídas */}
                <div className="grid sm:grid-cols-2">
                  {[
                    { title: "Entradas", rows: [
                      { l: "Faturamento bruto", v: total.gross, h: "Soma do faturado nos projetos no período." },
                    ], foot: { l: "Receita líquida", v: total.netRevenue, h: "Faturamento bruto menos impostos." } },
                    { title: "Saídas", rows: [
                      { l: "Impostos", v: total.tax, h: "Faturamento × alíquota da equipe.", minus: true },
                      { l: "Custo total", v: total.totalCost, h: "Horas apontadas × custo/hora + despesas diretas + rateio dos custos da equipe.", minus: true },
                    ], foot: null as null | { l: string; v: number; h: string } },
                  ].map((g, gi) => (
                    <div key={g.title} className={cn("px-4 py-3 sm:px-5", gi === 1 && "border-t sm:border-t-0 sm:border-l border-ops-ink-foreground/10")}>
                      <OpsLabel>{g.title}</OpsLabel>
                      <dl className="mt-1.5 space-y-2">
                        {g.rows.map((r) => (
                          <div key={r.l} className="min-w-0">
                            <dt className="flex items-center gap-1.5 text-xs text-ops-ink-foreground/70">{r.l}{hint(r.h)}</dt>
                            <dd className={cn("mt-0.5 tabular-nums text-base font-semibold whitespace-nowrap", r.minus && r.v > 0 && "text-ops-ink-foreground/80")}>
                              {ov.isLoading ? <Skeleton className="h-4 w-20 bg-ops-ink-foreground/10" /> : formatBRL(r.v)}
                            </dd>
                          </div>
                        ))}
                        {g.foot && (
                          <div className="min-w-0 border-t border-ops-ink-foreground/10 pt-1.5">
                            <dt className="flex items-center gap-1.5 text-xs font-semibold">{g.foot.l}{hint(g.foot.h)}</dt>
                            <dd className="mt-0.5 tabular-nums font-ops-display text-lg font-semibold whitespace-nowrap">
                              {ov.isLoading ? <Skeleton className="h-5 w-24 bg-ops-ink-foreground/10" /> : formatBRL(g.foot.v)}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {total.hoursWithoutCost > 0 && (
              <FinanceNotice tone="warn">
                {hrs(total.hoursWithoutCost)} apontadas por pessoas sem custo cadastrado no mês. O custo da equipe está subestimado até que esses custos sejam lançados.
              </FinanceNotice>
            )}

            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Evolução mensal</h2>
                <div className="h-64 mt-2">
                  {ov.isLoading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={months}>
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
                        <RTooltip formatter={(v: number) => formatBRL(v)} cursor={{ fill: "hsl(var(--muted-foreground) / 0.08)" }}
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, padding: "8px 10px" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} content={<MonthlyLegend resultTones={resultLegend} />} />
                        <Bar dataKey="Faturamento" fill="hsl(var(--chart-receita))" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Custos" name="Custos + impostos" fill="hsl(var(--chart-custo))" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Resultado" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]}>
                          {months.map((m, i) => <Cell key={i} fill={m.Resultado < 0 ? "hsl(var(--destructive))" : m.Resultado > 0 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
            </section>

            <FinanceSection title="Horas previstas × realizadas" description="Barra laranja: passou do previsto.">
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                {perBoard.map((b) => {
                  const ratio = b.hoursPlanned > 0 ? b.hoursRealized / b.hoursPlanned : null;
                  return (
                    <div key={b.boardId} className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{b.name}</span>
                        <span className={cn("font-ops-label text-xs tabular-nums shrink-0 text-muted-foreground", ratio !== null && ratio > 1 && "text-primary")}>
                          {hrs(b.hoursRealized)} / {b.hoursPlanned ? hrs(b.hoursPlanned) : "sem previsão"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full", ratio !== null && ratio > 1 ? "bg-primary" : "bg-foreground/60")} style={{ width: `${ratio === null ? 0 : Math.min(100, ratio * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </FinanceSection>

          </div>
        );
      case "byProject":
        return (
          <div className="space-y-4">
            <TeamRevenueTotal teamId={selectedTeamId} from={from} to={to} />
            <TeamProjectsFinance teamId={selectedTeamId} from={from} to={to} boards={perBoard} boardsLoading={ov.isLoading} onBoard={setDetail} />
          </div>
        );
      case "people":
        return <CostsProductivity rows={people.data ?? []} detailed={fin.can("finance.view_employee_costs")} isLoading={people.isLoading} isError={people.isError} onRetry={() => people.refetch()} boardOrder={boardOrder} teamId={selectedTeamId} canEdit={fin.can("finance.manage_settings")} />;
      case "simulator":
        return ov.isError ? <p className="py-6 text-sm text-muted-foreground">Os quadros autorizados não puderam ser carregados. Tente novamente acima.</p> :
          <PricingSimulator key={selectedTeamId} teamId={selectedTeamId!} boards={authorizedBoards} can={fin.can} isLoading={ov.isLoading} />;
      case "manage":
        return <FinanceManage teamId={selectedTeamId!} boards={boards.map((b) => ({ id: b.id, name: b.name }))} members={memberList} can={fin.can} canAny={fin.canAny} isOwnerOrAdmin={isOwnerOrAdmin} overview={scopedOv} />;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:h-full lg:min-h-0">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <OpsLabel>{currentTeam?.name ?? "Equipe"}</OpsLabel>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Inteligência Financeira</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-1.5">
          <MonthRangeField from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <div>
            <Select value={boardFilter} onValueChange={setBoardFilter}><SelectTrigger className="h-9 w-[180px] border-0 bg-muted/50" aria-label="Quadro"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos autorizados</SelectItem>{authorizedBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          {canExport && <ExportReportButton className="h-9" onExport={(f) => (f === "pdf" ? exportPdf() : exportCsv())} disabled={!sorted.length} />}
        </div>
      </header>

      {canView && ov.isError && (
        <FinanceNotice tone="error" action={<Button size="sm" variant="outline" className="gap-1.5" onClick={() => ov.refetch()}><RefreshCw className="h-4 w-4" />Tentar de novo</Button>}>
          Não foi possível carregar os números financeiros.
        </FinanceNotice>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:grid-rows-1 lg:gap-10">
        <nav aria-label="Seções financeiras" className="flex w-full gap-1 overflow-x-auto lg:flex-col lg:self-start">
          {sections.map(({ v, label, hint: h, icon: Icon }) => {
            const on = active === v;
            return (
              <button key={v} type="button" onClick={() => jumpTo(v)} aria-current={on ? "true" : undefined}
                className={cn("group flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  on ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-background", on && "border-primary/40 text-primary")}><Icon className="h-3.5 w-3.5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{label}</span>
                  <span className="hidden text-[11px] leading-tight text-muted-foreground lg:block">{h}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div ref={scrollRef} className="scroll-on-hover min-w-0 space-y-10 overflow-y-auto pr-1 pb-6 min-h-[24rem] lg:min-h-0">
          {sections.map(({ v, label, hint: h, icon: Icon }) => (
            <section key={v} ref={(el) => { sectionRefs.current[v] = el; }} aria-label={label} className="scroll-mt-2">
              <header className="mb-3 border-b pb-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border bg-muted/50 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                  {label}
                </h2>
                <p className="mt-1 pl-8 text-[11px] leading-tight text-muted-foreground">{h}</p>
              </header>
              {renderSection(v)}
            </section>
          ))}
        </div>
      </div>

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
                  ].map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className={cn("tabular-nums font-medium", k === "Resultado gerencial" && resultTone(detailRow.result))}>{v}</dd></div>)}
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
                          <span className={cn("tabular-nums text-right", resultTone(c.result))}>{formatBRL(c.result)}</span>
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
