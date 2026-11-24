import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Lock, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBRL, formatPct, resultLegendTones, resultTone, STATUS_LABEL } from "@/lib/finance/engine";
import { projectResult, type ProjectMonth } from "@/lib/finance/projectRollup";
import { ProfitabilityTable } from "./ProfitabilityTable";
import { DeviationTag, MarginRuler } from "./MarginRuler";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

interface TeamProject { project_id: string; name: string; months: ProjectMonth[] }

export interface BoardAgg { boardId: string; name: string; gross: number; result: number; margin: number | null; target: number; hoursRealized: number }

export function TeamProjectsFinance({ teamId, from, to, limit }: { teamId: string | null; from: string; to: string; limit?: number; boards?: BoardAgg[]; boardsLoading?: boolean; onBoard?: (id: string) => void }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["team-projects-finance", teamId, from, to, user?.id],
    enabled: !!user && !!teamId && from <= to,
    retry: (n, e: any) => !String(e?.message).includes("FORBIDDEN") && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_projects_finance", { _team_id: teamId!, _from: `${from}-01`, _to: `${to}-01` });
      if (error) throw error;
      return (data ?? []) as unknown as TeamProject[];
    },
  });

  if (q.isError && String((q.error as any)?.message).includes("FORBIDDEN"))
    return <p className="text-sm text-muted-foreground p-4">Você ainda não tem acesso aos números por projeto.</p>;
  if (q.isError)
    return (
      <div className="rounded-xl border p-6 text-center space-y-2">
        <p className="text-sm">Não foi possível carregar os projetos.</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><RotateCw className="h-4 w-4 mr-1" />Tentar de novo</Button>
      </div>
    );

  const rows = (q.data ?? []).map((p) => {
    const r = projectResult(p.months);
    const closed = p.months.length > 0 && p.months.every((m) => m.period_status !== "open");
    const incomplete = r.totals.hoursWithoutCost > 0;
    return { ...p, r, closed, incomplete };
  });

  if (q.isLoading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (rows.length === 0)
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum projeto com controle financeiro ligado nesta equipe.</p>;

  const ranked = [...rows].sort((a, b) => b.r.result - a.r.result);
  const compare = ranked.map((p) => ({ name: p.name.length > 18 ? p.name.slice(0, 17) + "…" : p.name, "Receita líquida": p.r.netRevenue, "Custo total": p.r.totalCost }));

  return (
    <div className="space-y-5">
      <ProfitabilityTable items={rows.map((p) => ({ id: p.project_id, name: p.name, gross: p.r.gross, netRevenue: p.r.netRevenue, totalCost: p.r.totalCost, hours: p.r.totals.hours, result: p.r.result, hoursWithoutCost: p.r.totals.hoursWithoutCost }))} />
      {rows.length > 1 && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Receita líquida × custo por projeto</h3>
          <p className="text-xs text-muted-foreground mb-3">Ordenados do melhor para o pior resultado no período.</p>
          <div style={{ height: Math.max(180, compare.length * 46 + 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare} layout="vertical" margin={{ left: 8, right: 16, top: 4 }} barGap={4}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => compact(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                <RTooltip formatter={(v: number) => formatBRL(v)} cursor={{ fill: "hsl(var(--muted-foreground) / 0.08)" }}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, padding: "8px 10px" }}
                  labelStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 4 }} />
                <Legend verticalAlign="bottom" height={26} content={<SeriesLegend />} />
                <Bar dataKey="Receita líquida" fill="hsl(var(--chart-receita))" radius={[0, 3, 3, 0]} barSize={13} />
                <Bar dataKey="Custo total" fill="hsl(var(--chart-custo))" radius={[0, 3, 3, 0]} barSize={13} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(limit ? ranked.slice(0, limit) : ranked).map((p) => <ProjectCard key={p.project_id} {...p} />)}
      </div>
      {limit && ranked.length > limit && (
        <div className="flex justify-center">
          <Button asChild variant="outline" className="gap-1.5">
            <Link to={`/app/finance/projetos?de=${from}&ate=${to}`}>Ver todos os {ranked.length} projetos<ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      )}
    </div>
  );
}

const compact = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

/** Legenda do gráfico de comparação: quadradinho na cor da série + nome. */
function SeriesLegend({ payload }: { payload?: { value?: string; color?: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-1 text-[11px] text-muted-foreground">
      {(payload ?? []).map((e) => (
        <li key={e.value} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: e.color }} aria-hidden />
          <span>{e.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ProjectCard({ name, months, r, closed, incomplete }: TeamProject & { r: ReturnType<typeof projectResult>; closed: boolean; incomplete: boolean }) {
  const t = r.totals;
  const taxes = Math.max(0, t.gross - r.netRevenue);
  const parts = [
    { k: "Impostos", v: taxes, cls: "bg-muted-foreground/40" },
    { k: "Equipe", v: t.teamCost, cls: "bg-primary" },
    { k: "Diretas + variáveis", v: t.direct + t.variable, cls: "bg-primary/55" },
    { k: "Rateio", v: t.fixed + t.operational + t.admin, cls: "bg-primary/25" },
    { k: "Resultado", v: Math.max(0, r.result), cls: "bg-foreground" },
  ];
  const scale = Math.max(t.gross, taxes + r.totalCost, 1);
  const empty = t.gross === 0 && r.totalCost === 0;
  const monthly = months.map((m) => {
    const x = projectResult([m]);
    return { mes: m.competence.substring(5, 7) + "/" + m.competence.substring(2, 4), Resultado: x.result };
  });

  return (
    <article className="rounded-xl border bg-card p-4 space-y-4">
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate flex items-center gap-1.5">{name}{closed && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Período fechado" />}</h3>
          <p className="text-xs text-muted-foreground">{STATUS_LABEL[r.status]}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-2xl font-semibold tabular-nums leading-none", resultTone(r.result))}>{formatBRL(r.result)}</p>
          <p className="mt-1 text-xs text-muted-foreground">resultado · margem {formatPct(r.margin)} <DeviationTag margin={r.margin} target={t.marginTarget} /></p>
        </div>
      </header>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Para onde vai o faturamento</span><span className="tabular-nums">Bruto {formatBRL(t.gross)}</span></div>
        {empty ? (
          <div className="h-3 rounded-full bg-muted" aria-label="Sem lançamentos no período" />
        ) : (
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Composição do faturamento">
            {parts.filter((x) => x.v > 0).map((x) => <div key={x.k} className={x.cls} style={{ width: `${(x.v / scale) * 100}%` }} title={`${x.k}: ${formatBRL(x.v)}`} />)}
          </div>
        )}
        {r.result < 0 && <p className="text-xs text-destructive">Os custos passaram o faturamento em {formatBRL(-r.result)}.</p>}
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {parts.slice(0, 4).map((x) => (
            <li key={x.k} className="flex items-center gap-1.5 min-w-0">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", x.cls)} />
              <span className="truncate text-muted-foreground">{x.k}</span>
              <span className="ml-auto tabular-nums">{compact(x.v)}</span>
            </li>
          ))}
        </ul>
      </div>

      <MarginRuler margin={r.margin} target={t.marginTarget} />

      {monthly.length > 1 && monthly.some((m) => m.Resultado !== 0) && (
        <div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <RTooltip formatter={(v: number) => formatBRL(v)} />
                <ReferenceLine y={0} className="stroke-border" />
                <Bar dataKey="Resultado" radius={[3, 3, 0, 0]}>
                  {monthly.map((m, i) => <Cell key={i} fill={m.Resultado < 0 ? "hsl(var(--destructive))" : m.Resultado > 0 ? "hsl(var(--success))" : "hsl(var(--foreground))"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            {resultLegendTones(monthly.map((m) => m.Resultado)).map((t) => (
              <span key={t.label} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
                {t.label}
              </span>
            ))}
          </p>
        </div>
      )}

      {empty && <p className="text-xs text-muted-foreground">Ainda não há faturamento nem custos neste período.</p>}
      {incomplete && <p className="text-xs text-primary">Custo incompleto: {t.hoursWithoutCost.toLocaleString("pt-BR")} h sem custo/hora cadastrado.</p>}
    </article>
  );
}
