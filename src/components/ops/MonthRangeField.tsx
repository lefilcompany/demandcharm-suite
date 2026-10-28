import * as React from "react";
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const toKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const parts = (iso: string) => ({ y: Number(iso.substring(0, 4)), m: Number(iso.substring(5, 7)) - 1 });
const cmp = (a: string, b: string) => a.localeCompare(b);
const shift = (iso: string, delta: number) => {
  const { y, m } = parts(iso);
  const t = y * 12 + m + delta;
  return toKey(Math.floor(t / 12), ((t % 12) + 12) % 12);
};
const nowKey = () => {
  const d = new Date();
  return toKey(d.getFullYear(), d.getMonth());
};
const monthLabel = (iso: string) => {
  if (!/^\d{4}-\d{2}$/.test(iso)) return "—";
  const { y, m } = parts(iso);
  return `${MONTHS[m]}/${y}`;
};

const focusRing = "focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]";

type Preset = { label: string; pick: () => void };

function Segment({
  value, onPick, min, max, spanFrom, spanTo, ariaLabel, presets,
}: {
  value: string;
  onPick: (iso: string) => void;
  min?: string;
  max?: string;
  spanFrom: string;
  spanTo: string;
  ariaLabel: string;
  presets: Preset[];
}) {
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(() => parts(value).y);

  React.useEffect(() => {
    if (open) setYear(parts(value).y);
  }, [open, value]);

  const today = nowKey();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-full items-center gap-1.5 px-2 font-ops-display text-[15px] font-medium leading-none tabular-nums transition-colors",
            "hover:bg-muted/70 data-[state=open]:bg-muted",
            focusRing,
          )}
        >
          {monthLabel(value)}
          <ChevronDown className={cn("h-3.5 w-3.5 opacity-40 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[254px] p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Ano anterior"
            onClick={() => setYear((y) => y - 1)}
            className={cn("rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", focusRing)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-ops-display text-lg font-semibold leading-none tabular-nums">{year}</span>
          <button
            type="button"
            aria-label="Próximo ano"
            onClick={() => setYear((y) => y + 1)}
            className={cn("rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", focusRing)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1">
          {MONTHS.map((name, m) => {
            const iso = toKey(year, m);
            const blocked = (!!min && cmp(iso, min) < 0) || (!!max && cmp(iso, max) > 0);
            const selected = iso === value;
            const spanned = cmp(iso, spanFrom) >= 0 && cmp(iso, spanTo) <= 0;
            return (
              <button
                key={iso}
                type="button"
                disabled={blocked}
                aria-pressed={selected}
                onClick={() => {
                  onPick(iso);
                  setOpen(false);
                }}
                className={cn(
                  "h-8 rounded-[3px] font-ops-label text-[11px] uppercase tracking-wider transition-colors",
                  focusRing,
                  blocked && "cursor-not-allowed text-muted-foreground/40",
                  !blocked && selected && "bg-primary font-semibold text-primary-foreground",
                  !blocked && !selected && spanned && "bg-primary/[0.16] font-medium text-foreground hover:bg-primary/25",
                  !blocked && !selected && !spanned && "text-muted-foreground hover:bg-muted hover:text-foreground",

                  iso === today && !selected && "ring-1 ring-inset ring-foreground/20",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-1 border-t pt-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                p.pick();
                setOpen(false);
              }}
              className={cn(
                "flex-1 rounded px-1 py-1.5 font-ops-label text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                focusRing,
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MonthRangeField({
  from, to, onChange, min, max, className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const today = nowKey();
  const yearStart = `${today.substring(0, 4)}-01`;

  const presets: Preset[] = [
    { label: "atual", pick: () => onChange(today, today) },
    { label: "6m", pick: () => onChange(shift(today, -5), today) },
    { label: "12m", pick: () => onChange(shift(today, -11), today) },
    { label: "ano", pick: () => onChange(yearStart, today) },
  ];

  const setFrom = (v: string) => onChange(v, cmp(v, to) > 0 ? v : to);
  const setTo = (v: string) => onChange(cmp(v, from) < 0 ? v : from, v);

  return (
    <div
      className={cn(
        "inline-flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background transition-[border-color,box-shadow] duration-200 focus-within:[box-shadow:var(--focus-ring)]",
        className,
      )}
    >
      <span className="flex items-center pl-3 pr-1 text-muted-foreground" aria-hidden="true">
        <CalendarDays className="h-3.5 w-3.5" />
      </span>
      <Segment
        value={from}
        onPick={setFrom}
        min={min}
        max={to}
        spanFrom={from}
        spanTo={to}
        ariaLabel="Mês inicial do período"
        presets={presets}
      />
      <span className="flex items-center text-muted-foreground/50" aria-hidden="true">
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
      <Segment
        value={to}
        onPick={setTo}
        min={from}
        max={max}
        spanFrom={from}
        spanTo={to}
        ariaLabel="Mês final do período"
        presets={presets}
      />
    </div>
  );
}
