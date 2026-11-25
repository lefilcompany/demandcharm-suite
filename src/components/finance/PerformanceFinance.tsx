import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBRL, formatPct } from "@/lib/finance/engine";
import type { ProjectMonth } from "@/lib/finance/projectRollup";
import { rollupByPerformance } from "@/lib/finance/performanceRollup";
import { useTeamPerformances } from "@/hooks/useTeamPositions";

const tip = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, padding: "8px 10px" };
const compact = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const tone = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground");

export function PerformanceFinance({ teamId, from, to, onGroups }: { teamId: string | null; from: string; to: string; onGroups?: (g: ReturnType<typeof rollupByPerformance>) => void }) {
  const { user } = useAuth();
  const perfs = useTeamPerformances(teamId);
  const q = useQuery({
    queryKey: ["performance-finance", teamId, from, to, user?.id],
    enabled: !!user && !!teamId && from <= to,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_projects_finance", { _team_id: teamId!, _from: `${from}-01`, _to: `${to}-01` });
      if (error) throw error;
      const list = (data ?? []) as unknown as { project_id: string; name: string; months: ProjectMonth[] }[];
      const ids = list.map((p) => p.project_id);
      const meta = ids.length ? await supabase.from("projects").select("id, performance_id, status").in("id", ids) : { data: [], error: null };
      if (meta.error) throw meta.error;
      const m = new Map((meta.data ?? []).map((r: any) => [r.id, r]));
      return list.map((p) => ({ ...p, performance_id: (m.get(p.project_id) as any)?.performance_id ?? null, active: ((m.get(p.project_id) as any)?.status ?? "active") === "active" }));
    },
  });
  const [open, setOpen] = useState<string | null>(null);

  if (q.isError || perfs.isError)
    return (
      <div className="rounded-xl border p-6 text-center space-y-2">
        <p className="text-sm">Não foi possível carregar os números por performance.</p>
        <Button size="sm" variant="outline" onClick={() => { q.refetch(); perfs.refetch(); }}><RotateCw className="h-4 w-4 mr-1" />Tentar de novo</Button>
      </div>
    );
  if (q.isLoading || perfs.isLoading) return <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>;

  const groups = rollupByPerformance(q.data ?? [], (perfs.data ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color })));
  onGroups?.(groups);
  if (!groups.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum projeto com controle financeiro nesta equipe.</p>;

  const totalGross = groups.reduce((a, g) => a + g.r.gross, 0);
  const cmp = groups.map((g) => ({ name: g.name, Faturamento: g.r.gross, "Custo total": g.r.totalCost + g.r.tax, Resultado: g.r.result }));
  const comp = groups.map((g) => ({ name: g.name, "Hora/homem": g.r.totals.teamCost, Impostos: g.r.tax, "Despesas diretas": g.r.totals.direct + g.r.totals.variable, "Custos gerais rateados": g.r.totals.fixed + g.r.totals.operational + g.r.totals.admin }));
  const share = groups.filter((g) => g.r.gross > 0).map((g) => ({ name: g.name, value: g.r.gross, color: g.color }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <article key={g.id} className="rounded-xl border bg-card p-4 space-y-3" style={{ borderTop: `3px solid ${g.color}` }}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold truncate">{g.name}</h3>
              <span className="text-xs text-muted-foreground">{g.activeCount} ativo{g.activeCount === 1 ? "" : "s"} / {g.projectCount} projeto{g.projectCount === 1 ? "" : "s"}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resultado</p>
              <p className={cn("text-2xl font-semibold tabular-nums", tone(g.r.result))}>{formatBRL(g.r.result)}</p>
              <p className="text-xs text-muted-foreground">Margem {g.r.margin === null ? "—" : formatPct(g.r.margin)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted-foreground">Faturamento</dt><dd className="font-medium tabular-nums">{formatBRL(g.r.gross)}</dd></div>
              <div><dt className="text-muted-foreground">Receita líquida</dt><dd className="font-medium tabular-nums">{formatBRL(g.r.netRevenue)}</dd></div>
              <div><dt className="text-muted-foreground">Custo hora/homem</dt><dd className="font-medium tabular-nums">{formatBRL(g.r.totals.teamCost)}</dd></div>
              <div><dt className="text-muted-foreground">Custo total</dt><dd className="font-medium tabular-nums">{formatBRL(g.r.totalCost)}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold">Faturamento × custo por performance</h3>
          <p className="text-xs text-muted-foreground mb-3">Custo inclui impostos. Barra de resultado verde quando positivo, vermelha quando negativo.</p>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={cmp}><CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} /><YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <RTooltip formatter={(v: number) => formatBRL(v)} contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Faturamento" fill="hsl(var(--chart-receita))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Custo total" fill="hsl(var(--chart-custo))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Resultado" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]}>{cmp.map((c, i) => <Cell key={i} fill={c.Resultado < 0 ? "hsl(var(--destructive))" : "hsl(var(--success))"} />)}</Bar>
            </BarChart></ResponsiveContainer></div>
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Participação no faturamento</h3>
          <p className="text-xs text-muted-foreground mb-3">Total {formatBRL(totalGross)}</p>
          {share.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={share} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>{share.map((s, i) => <Cell key={i} fill={s.color} />)}</Pie>
              <RTooltip formatter={(v: number) => `${formatBRL(v)} (${formatPct(v / totalGross)})`} contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
          </ResponsiveContainer></div> : <p className="py-10 text-center text-xs text-muted-foreground">Sem faturamento no período.</p>}
        </section>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Composição do custo</h3>
        <p className="text-xs text-muted-foreground mb-3">De onde vem o custo de cada performance.</p>
        <div style={{ height: Math.max(160, comp.length * 44 + 40) }}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={comp} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
            <RTooltip formatter={(v: number) => formatBRL(v)} contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Hora/homem" stackId="c" fill="hsl(var(--chart-custo))" barSize={16} />
            <Bar dataKey="Impostos" stackId="c" fill="hsl(var(--destructive) / 0.6)" />
            <Bar dataKey="Despesas diretas" stackId="c" fill="hsl(var(--muted-foreground) / 0.7)" />
            <Bar dataKey="Custos gerais rateados" stackId="c" fill="hsl(var(--primary) / 0.6)" radius={[0, 3, 3, 0]} />
          </BarChart></ResponsiveContainer></div>
      </section>

      <section className="rounded-xl border bg-card divide-y">
        {groups.map((g) => (
          <div key={g.id}>
            <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: g.color }} />
              <span className="flex-1 font-medium text-sm truncate">{g.name}</span>
              <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">{g.r.totals.hours.toLocaleString("pt-BR")} h</span>
              <span className={cn("text-sm font-semibold tabular-nums", tone(g.r.result))}>{formatBRL(g.r.result)}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open === g.id && "rotate-180")} />
            </button>
            {open === g.id && (
              <table className="w-full text-xs mb-2">
                <thead><tr className="text-left text-muted-foreground"><th className="px-4 py-1 font-medium">Projeto</th><th className="py-1 font-medium text-right">Faturamento</th><th className="py-1 font-medium text-right">Hora/homem</th><th className="py-1 font-medium text-right">Custo total</th><th className="px-4 py-1 font-medium text-right">Resultado</th></tr></thead>
                <tbody>{g.projects.map((p) => (
                  <tr key={p.project_id} className="border-t border-border/50">
                    <td className="px-4 py-1.5"><Link to={`/app/projects/${p.project_id}/finance`} className="hover:underline">{p.name}</Link>{!p.active && <span className="ml-1.5 text-muted-foreground">(inativo)</span>}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatBRL(p.r.gross)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatBRL(p.r.totals.teamCost)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatBRL(p.r.totalCost)}</td>
                    <td className={cn("px-4 py-1.5 text-right tabular-nums font-medium", tone(p.r.result))}>{formatBRL(p.r.result)}</td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
