import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBRL } from "@/lib/finance/engine";
import { cn } from "@/lib/utils";

export interface BarPart { key: string; label: string; amount: number }

/** Stable tone per board so the same project keeps its colour across every bar. */
export const toneFor = (key: string, order: string[]) => `hsl(var(--plan-${(Math.max(0, order.indexOf(key)) % 5) + 1}))`;

const HATCH = "repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.35) 0 2px, transparent 2px 6px)";

export function AllocationBar({ parts, unallocated = 0, total, order, className }: {
  parts: BarPart[]; unallocated?: number; total: number; order: string[]; className?: string;
}) {
  const base = total > 0 ? total : 1;
  return (
    <div className={cn("flex h-3 w-full overflow-hidden rounded-sm bg-muted", className)} role="img"
      aria-label={parts.map((p) => `${p.label} ${formatBRL(p.amount)}`).join(", ") + (unallocated > 0 ? `, não rateado ${formatBRL(unallocated)}` : "")}>
      {parts.map((p) => (
        <Tooltip key={p.key}>
          <TooltipTrigger asChild>
            <span className="h-full border-r border-background last:border-r-0 transition-opacity hover:opacity-80"
              style={{ width: `${(p.amount / base) * 100}%`, background: toneFor(p.key, order) }} />
          </TooltipTrigger>
          <TooltipContent><span className="font-medium">{p.label}</span> · {formatBRL(p.amount)} ({((p.amount / base) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</TooltipContent>
        </Tooltip>
      ))}
      {unallocated > 0 && (
        <Tooltip>
          <TooltipTrigger asChild><span className="h-full" style={{ width: `${(unallocated / base) * 100}%`, background: HATCH }} /></TooltipTrigger>
          <TooltipContent>Não rateado · {formatBRL(unallocated)}. Nenhum quadro teve horas ou faturamento no mês para dividir esse valor.</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/** Thin occupancy ruler with fixed 50% and 100% marks; the bar is clipped at 150%. */
export function OccupancyRuler({ value }: { value: number | null }) {
  const v = value ?? 0, max = 1.5;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted" aria-label={value === null ? "Sem referência" : `Ocupação ${Math.round(v * 100)}%`}>
      <span className={cn("absolute inset-y-0 left-0 rounded-full", v > 1 ? "bg-primary" : v < 0.5 ? "bg-muted-foreground/50" : "bg-foreground/70")}
        style={{ width: `${(Math.min(v, max) / max) * 100}%` }} />
      {[0.5, 1].map((m) => <span key={m} className="absolute -top-0.5 h-2.5 w-px bg-foreground/60" style={{ left: `${(m / max) * 100}%` }} />)}
    </div>
  );
}
