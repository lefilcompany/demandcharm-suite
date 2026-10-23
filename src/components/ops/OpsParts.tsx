import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const PLAN_COLORS = [1, 2, 3, 4, 5].map((n) => `hsl(var(--plan-${n}))`);

export function OpsLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-ops-label text-[10px] uppercase tracking-[0.18em] text-ops-muted", className)}>
      {children}
    </span>
  );
}

function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return value;
}

export interface CommandMetric {
  label: string;
  value: number;
  note: string;
  /** 0..1 share shown as the orange gauge */
  gauge?: number;
}

function Metric({ m, loading }: { m: CommandMetric; loading: boolean }) {
  const v = useCountUp(m.value, !loading);
  return (
    <div className="flex flex-col gap-2 px-4 py-4 sm:px-6 sm:py-5 border-ops-ink-foreground/10 [&:not(:first-child)]:md:border-l odd:border-r md:odd:border-r-0 [&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-b-0">
      <OpsLabel>{m.label}</OpsLabel>
      {loading ? (
        <Skeleton className="h-10 w-20 bg-ops-ink-foreground/10" />
      ) : (
        <span className="font-ops-display text-4xl sm:text-5xl font-semibold leading-none tabular-nums text-ops-ink-foreground">
          {v.toLocaleString("pt-BR")}
        </span>
      )}
      <div className="h-[3px] w-full bg-ops-ink-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${Math.max(m.gauge ?? 0, m.gauge ? 0.04 : 0) * 100}%` }}
        />
      </div>
      <span className="text-xs text-ops-ink-foreground/70">{m.note}</span>
    </div>
  );
}

export function CommandStrip({ metrics, loading, updatedAt }: { metrics: CommandMetric[]; loading: boolean; updatedAt: Date }) {
  return (
    <section aria-label="Números da plataforma" className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <OpsLabel className="text-ops-ink-foreground/80">SoMA+ · operação</OpsLabel>
        </div>
        <OpsLabel>Leitura {format(updatedAt, "dd/MM · HH:mm")}</OpsLabel>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4">
        {metrics.map((m) => (
          <Metric key={m.label} m={m} loading={loading} />
        ))}
      </div>
    </section>
  );
}

interface Trial { id: string; trial_ends_at: string; teams?: { name?: string } | null }

export function TrialTimeline({ trials, loading }: { trials: Trial[]; loading: boolean }) {
  const today = new Date();
  return (
    <section aria-label="Trials que vencem" className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold">Precisa de atenção</h2>
        <OpsLabel>Trials · próximos 7 dias</OpsLabel>
      </div>
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : trials.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum trial vence nos próximos 7 dias.</p>
      ) : (
        <>
          {/* Desktop: régua de 7 dias */}
          <div className="hidden md:block relative h-24 mt-2">
            <div className="absolute left-0 right-0 top-10 h-px bg-border" />
            {Array.from({ length: 8 }, (_, d) => (
              <div key={d} className="absolute top-8 -translate-x-1/2 flex flex-col items-center" style={{ left: `${(d / 7) * 100}%` }}>
                <span className="h-4 w-px bg-border" />
                <OpsLabel className="mt-9">{d === 0 ? "hoje" : `+${d}d`}</OpsLabel>
              </div>
            ))}
            {trials.map((t, i) => {
              const d = Math.min(7, Math.max(0, differenceInCalendarDays(new Date(t.trial_ends_at), today)));
              return (
                <div
                  key={t.id}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${(d / 7) * 100}%`, top: i % 2 ? 0 : 14 }}
                  title={`${t.teams?.name ?? "Equipe"} · ${format(new Date(t.trial_ends_at), "dd/MM HH:mm")}`}
                >
                  <span className="whitespace-nowrap rounded-md bg-ops-alert/10 text-ops-alert text-[11px] font-medium px-1.5 py-0.5 max-w-[140px] truncate">
                    {t.teams?.name ?? "Equipe"}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Mobile: lista */}
          <ul className="md:hidden divide-y">
            {trials.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{t.teams?.name ?? "Equipe"}</span>
                <span className="text-ops-alert text-xs font-medium shrink-0">
                  vence {formatDistanceToNow(new Date(t.trial_ends_at), { locale: ptBR, addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function PlanSplitBar({ plans, loading }: { plans: { name: string; count: number }[]; loading: boolean }) {
  const total = plans.reduce((a, p) => a + p.count, 0);
  return (
    <section aria-label="Planos ativos" className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm flex flex-col">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold">Planos ativos</h2>
        <OpsLabel>{total} equipes</OpsLabel>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa ou em trial.</p>
      ) : (
        <>
          <div className="flex h-8 w-full rounded-md overflow-hidden gap-px bg-border">
            {plans.map((p, i) => (
              <div key={p.name} style={{ width: `${(p.count / total) * 100}%`, backgroundColor: PLAN_COLORS[i % 5] }} title={`${p.name}: ${p.count}`} />
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {plans.map((p, i) => (
              <li key={p.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLAN_COLORS[i % 5] }} />
                <span className="flex-1 truncate text-muted-foreground">{p.name}</span>
                <span className="font-ops-display text-lg font-semibold tabular-nums">{p.count}</span>
                <span className="w-10 text-right font-ops-label text-[10px] text-ops-muted">{Math.round((p.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export interface Arrival { id: string; kind: "team" | "user"; name: string; detail?: string; created_at: string; avatar?: string | null; badge?: string }

export function ArrivalsFeed({ items, loading }: { items: Arrival[]; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <section aria-label="Chegadas recentes" className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold">Entraram por último</h2>
        <div className="flex gap-3">
          <button onClick={() => navigate("/admin/teams")} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Ver equipes <ArrowUpRight className="h-3 w-3" />
          </button>
          <button onClick={() => navigate("/admin/users")} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Ver usuários <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Ninguém entrou ainda.</p>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={`${a.kind}-${a.id}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 sm:px-5 py-2.5">
              <OpsLabel className={a.kind === "team" ? "text-primary" : undefined}>{a.kind === "team" ? "Equipe" : "Pessoa"}</OpsLabel>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.name}</p>
                {a.detail && <p className="text-xs text-muted-foreground truncate">{a.detail}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.badge && <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{a.badge}</span>}
                <span className="text-xs text-muted-foreground" title={format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}>
                  {formatDistanceToNow(new Date(a.created_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
