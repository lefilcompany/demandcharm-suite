import { cn } from "@/lib/utils";
import { formatPct, formatPp } from "@/lib/finance/engine";

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

export function DeviationTag({ margin, target }: { margin: number | null; target: number }) {
  if (margin === null) return <span className="font-ops-label text-xs text-muted-foreground">—</span>;
  const d = (margin - target) * 100;
  return (
    <span className={cn("font-ops-label text-xs tabular-nums", d >= 0 ? "text-foreground" : margin < 0 ? "text-destructive" : "text-primary")}>
      {formatPp(d)}
    </span>
  );
}
