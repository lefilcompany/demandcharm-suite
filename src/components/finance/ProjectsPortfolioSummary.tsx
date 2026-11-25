import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProjectMonth } from "@/lib/finance/projectRollup";

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Sumário: % de projetos ativos, % de ativos com faturamento e horas registradas × previstas por projeto. */
export function ProjectsPortfolioSummary({ teamId, from, to }: { teamId: string | null; from: string; to: string }) {
  const { user } = useAuth();
  const enabled = !!user && !!teamId && from <= to;
  const hoursQ = useQuery({
    queryKey: ["team-projects-hours", teamId, from, to, user?.id], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_projects_hours", { _team_id: teamId!, _from: `${from}-01`, _to: `${to}-01` });
      if (error) throw error;
      return data ?? [];
    },
  });
  const finQ = useQuery({
    queryKey: ["team-projects-finance", teamId, from, to, user?.id], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_projects_finance", { _team_id: teamId!, _from: `${from}-01`, _to: `${to}-01` });
      if (error) throw error;
      return (data ?? []) as unknown as { project_id: string; name: string; months: ProjectMonth[] }[];
    },
  });

  if (hoursQ.isLoading || finQ.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (hoursQ.isError || finQ.isError) return null;

  const fin = new Map((finQ.data ?? []).map((p) => [p.project_id, p.months]));
  const projects = (hoursQ.data ?? []).map((p) => {
    const months = fin.get(p.project_id) ?? [];
    return {
      id: p.project_id, name: p.name, active: p.status !== "inactive",
      gross: months.reduce((a, m) => a + Number(m.gross || 0), 0),
      planned: months.reduce((a, m) => a + Number(m.hours || 0), 0),
      registered: Number(p.hours_registered || 0),
    };
  });
  const total = projects.length;
  const active = projects.filter((p) => p.active);
  const withRevenue = active.filter((p) => p.gross > 0);
  const activePct = total ? active.length / total : null;
  const revenuePct = active.length ? withRevenue.length / active.length : null;
  const sumReg = active.reduce((a, p) => a + p.registered, 0);
  const sumPlan = active.reduce((a, p) => a + p.planned, 0);
  const hoursPct = sumPlan > 0 ? sumReg / sumPlan : null;
  const list = [...projects].sort((a, b) => Number(b.active) - Number(a.active) || b.planned - a.planned);

  const Ring = ({ v, label, sub }: { v: number | null; label: string; sub: string }) => {
    const r = 26, c = 2 * Math.PI * r, f = Math.min(1, v ?? 0);
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${f * c} ${c}`} />
        </svg>
        <div className="min-w-0">
          <div className="font-ops-display text-2xl font-semibold tabular-nums leading-none">{pct(v)}</div>
          <div className="mt-1 text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Ring v={activePct} label="Projetos ativos" sub={`${active.length} de ${total} projetos`} />
        <Ring v={revenuePct} label="Ativos com faturamento" sub={`${withRevenue.length} de ${active.length} ativos faturam no período`} />
        <Ring v={hoursPct} label="Horas registradas × previstas" sub={`${hrs(sumReg)} de ${hrs(sumPlan)} nos ativos`} />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Horas por projeto</h3>
            <p className="text-xs text-muted-foreground">Registradas nas demandas × previstas (horas contratadas dos integrantes).</p>
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-muted-foreground/25" />Previstas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-primary" />Registradas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-destructive" />Acima do previsto</span>
          </div>
        </div>
        {list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum projeto nesta equipe.</p> : (
          <ul className="space-y-3">
            {list.map((p) => {
              const ratio = p.planned > 0 ? p.registered / p.planned : null;
              const over = ratio != null && ratio > 1;
              return (
                <li key={p.id} className={cn("text-sm", !p.active && "opacity-60")}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      {!p.active && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">Inativo</span>}
                      {p.active && p.gross <= 0 && <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">Sem faturamento</span>}
                    </span>
                    <span className={cn("shrink-0 tabular-nums text-xs text-muted-foreground", over && "text-destructive font-semibold")}>
                      {hrs(p.registered)} / {p.planned > 0 ? hrs(p.planned) : "sem previsão"} {ratio != null && `· ${pct(ratio)}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted-foreground/15">
                    <div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${ratio == null ? 0 : Math.min(100, ratio * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
