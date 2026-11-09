import * as React from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const now = () => { const d = new Date(); return key(d.getFullYear(), d.getMonth()); };

/** Single-month picker matching MonthRangeField; value is "YYYY-MM". */
export function MonthField({ value, onChange, max, className, "aria-label": ariaLabel, tone = "light" }: {
  value: string; onChange: (v: string) => void; max?: string; className?: string; "aria-label"?: string; tone?: "light" | "ink";
}) {
  const valid = /^\d{4}-\d{2}$/.test(value);
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(() => Number((valid ? value : now()).substring(0, 4)));
  React.useEffect(() => { if (open && valid) setYear(Number(value.substring(0, 4))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = now();
  const label = valid ? `${MONTHS[Number(value.substring(5, 7)) - 1]}/${value.substring(0, 4)}` : "Escolher mês";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={ariaLabel ?? "Mês"}
          className={cn("flex h-9 w-full min-w-[140px] items-center gap-2 rounded-md border px-3 text-sm font-ops-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone === "ink" ? "border-ops-ink-foreground/20 bg-transparent text-ops-ink-foreground" : "border-input bg-background hover:border-primary/50", className)}>
          <CalendarDays className="h-4 w-4 opacity-60" />
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)} className="rounded p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-ops-mono text-sm font-medium">{year}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setYear(year + 1)} className="rounded p-1 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((m, i) => {
            const k = key(year, i);
            const disabled = !!max && k > max;
            const sel = k === value;
            return (
              <button key={k} type="button" disabled={disabled} onClick={() => { onChange(k); setOpen(false); }}
                className={cn("relative rounded-md py-1.5 text-sm capitalize disabled:opacity-30",
                  sel ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  k === current && !sel && "font-semibold text-primary")}>
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
