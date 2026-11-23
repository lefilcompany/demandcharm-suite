import { cn } from "@/lib/utils";
import { formatPct, formatPp, marginGoalState, type MarginGoalTone } from "@/lib/finance/engine";

/** Signature element: realized margin on a -20%..80% ruler with the target notch. */
export function MarginRuler({ margin, target, compact = false }: { margin: number | null; target: number; compact?: boolean }) {
  const MIN = -0.2, MAX = 0.8;
  const pos = (v: number) => `${((Math.min(Math.max(v, MIN), MAX) - MIN) / (MAX - MIN)) * 100}%`;
  const zero = pos(0);
  const below = margin !== null && margin < target;
  const negative = margin !== null && margin < 0;
  return (
    <div className={cn("w-full", compact ? "min-w-[140px]" : "")}>
      <div className="relative h-2.5 rounded-sm bg-muted overflow-visible" role="img"
        aria-label={margin === null ? "Margem indisponível" : `Margem ${formatPct(margin)}, meta ${formatPct(target)}`}>
        {margin !== null && (
          <div
            className={cn("absolute top-0 h-full rounded-sm transition-[width,left] duration-700 motion-reduce:transition-none",
              negative ? "bg-destructive" : below ? "bg-primary" : "bg-ops-ink dark:bg-foreground")}
            style={negative ? { left: pos(margin), width: `calc(${zero} - ${pos(margin)})` } : { left: zero, width: `calc(${pos(margin)} - ${zero})` }}
          />
        )}
        <span className="absolute -top-1 h-[18px] w-px bg-muted-foreground/50" style={{ left: zero }} aria-hidden />
        <span className="absolute -top-1.5 h-[22px] w-[2px] bg-primary" style={{ left: pos(target) }} aria-hidden />
      </div>
      {!compact && (
        <div className="relative mt-1.5 h-4 font-ops-label text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="absolute -translate-x-1/2" style={{ left: zero }}>0</span>
          <span className="absolute -translate-x-1/2 text-primary" style={{ left: pos(target) }}>meta {formatPct(target)}</span>
        </div>
      )}
    </div>
  );
}

const GOAL_TEXT: Record<MarginGoalTone, { ink: string; card: string }> = {
  muted: { ink: "text-ops-ink-foreground/60", card: "text-muted-foreground" },
  destructive: { ink: "text-destructive", card: "text-destructive" },
  primary: { ink: "text-primary", card: "text-primary" },
  success: { ink: "text-success", card: "text-success" },
};
const GOAL_FILL: Record<MarginGoalTone, string> = {
  muted: "bg-transparent",
  destructive: "bg-destructive",
  primary: "bg-primary",
  success: "bg-success",
};

/** Profit margin as progress toward the team's goal, with the goal spelled out. */
export function MarginGoalBar({ margin, target, variant = "card" }: { margin: number | null; target: number; variant?: "ink" | "card" }) {
  const s = marginGoalState(margin, target);
  const ink = variant === "ink";
  return (
    <div className={cn("space-y-1.5", ink ? "text-ops-ink-foreground" : "text-foreground")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("font-ops-label text-[10px] uppercase tracking-[0.18em]", ink ? "text-ops-muted" : "text-muted-foreground")}>
          Meta de lucro da equipe
        </span>
        <span className={cn("text-xs tabular-nums", ink ? "text-ops-ink-foreground/80" : "text-muted-foreground")}>
          {formatPct(target)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" role="img"
        aria-label={`Margem de lucro ${formatPct(margin)}, meta da equipe ${formatPct(target)}. ${s.text}`}>
        <div className={cn("h-full w-full", ink ? "bg-ops-ink-foreground/15" : "bg-muted")}>
          <div className={cn("h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none", GOAL_FILL[s.tone])}
            style={{ width: `${s.progress * 100}%` }} />
        </div>
      </div>
      <p className={cn("text-xs", GOAL_TEXT[s.tone][variant])}>{s.text}</p>
      <p className={cn("text-[11px]", ink ? "text-ops-ink-foreground/55" : "text-muted-foreground")}>
        Margem de lucro = resultado ÷ faturamento. A barra cresce até a meta; cheia significa meta alcançada.
      </p>
    </div>
  );
}

export function DeviationTag({ margin, target }: { margin: number | null; target: number }) {
  if (margin === null) return <span className="font-ops-label text-xs text-muted-foreground">—</span>;
  const d = (margin - target) * 100;
  return (
    <span className={cn("font-ops-label text-xs tabular-nums", d >= 0 ? "text-foreground" : margin < 0 ? "text-destructive" : "text-primary")}>
      {formatPp(d)}
    </span>
  );
}
