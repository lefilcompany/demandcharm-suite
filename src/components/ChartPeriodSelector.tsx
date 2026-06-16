import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChartPeriodType = "month" | "3months" | "6months" | "year" | "all";

interface ChartPeriodSelectorProps {
  value: ChartPeriodType;
  onChange: (period: ChartPeriodType) => void;
  className?: string;
  compact?: boolean;
}

const PERIOD_OPTIONS: { value: ChartPeriodType; label: string; shortLabel: string }[] = [
  { value: "month", label: "Este mês", shortLabel: "Mês" },
  { value: "3months", label: "3 meses", shortLabel: "3m" },
  { value: "6months", label: "6 meses", shortLabel: "6m" },
  { value: "year", label: "1 ano", shortLabel: "1a" },
  { value: "all", label: "Tudo", shortLabel: "All" },
];

export function ChartPeriodSelector({ value, onChange, className, compact }: ChartPeriodSelectorProps) {
  return (
    <div className={cn("flex items-center gap-0.5 flex-nowrap", className)}>
      <Calendar className="h-3 w-3 text-muted-foreground mr-0.5 shrink-0 hidden sm:block" />
      {PERIOD_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "font-medium shrink-0",
            compact
              ? "h-5 px-1.5 text-[9px] md:h-6 md:px-2 md:text-[10px]"
              : "h-6 px-2 text-[10px]",
            value === option.value && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          onClick={() => onChange(option.value)}
        >
          {compact ? option.shortLabel : option.label}
        </Button>
      ))}
    </div>
  );
}

// Utility function to get date range from period
export function getChartPeriodRange(period: ChartPeriodType): { start: Date | null; end: Date } {
  const now = new Date();
  const end = now;

  switch (period) {
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end,
      };
    case "3months":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        end,
      };
    case "6months":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        end,
      };
    case "year":
      return {
        start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
        end,
      };
    case "all":
      return {
        start: null,
        end,
      };
  }
}
