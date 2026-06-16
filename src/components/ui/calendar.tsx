import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  disablePastDates?: boolean;
};

type ViewMode = "days" | "months" | "years";

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  disablePastDates,
  month: controlledMonth,
  onMonthChange,
  disabled,
  ...props
}: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMode, setViewMode] = React.useState<ViewMode>("days");
  const [internalMonth, setInternalMonth] = React.useState(
    controlledMonth || props.defaultMonth || new Date()
  );
  const [yearPageStart, setYearPageStart] = React.useState(
    Math.floor((controlledMonth || new Date()).getFullYear() / 10) * 10
  );

  const displayMonth = controlledMonth || internalMonth;

  const handleMonthChange = (newMonth: Date) => {
    setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  };

  const navigateMonth = (delta: number) => {
    if (viewMode === "days") {
      const next = new Date(displayMonth);
      next.setMonth(next.getMonth() + delta);
      if (disablePastDates) {
        const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (next < minMonth) return;
      }
      handleMonthChange(next);
    } else if (viewMode === "months") {
      const next = new Date(displayMonth);
      next.setFullYear(next.getFullYear() + delta);
      if (disablePastDates && next.getFullYear() < today.getFullYear()) return;
      handleMonthChange(next);
    } else if (viewMode === "years") {
      setYearPageStart((prev) => prev + delta * 10);
    }
  };

  const isMonthDisabled = (monthIndex: number) => {
    if (!disablePastDates) return false;
    return (
      displayMonth.getFullYear() === today.getFullYear() &&
      monthIndex < today.getMonth()
    );
  };

  const isYearDisabled = (year: number) => {
    if (!disablePastDates) return false;
    return year < today.getFullYear();
  };

  const isPrevDisabled = () => {
    if (!disablePastDates) return false;
    if (viewMode === "days") {
      return (
        displayMonth.getFullYear() === today.getFullYear() &&
        displayMonth.getMonth() <= today.getMonth()
      );
    }
    if (viewMode === "months") {
      return displayMonth.getFullYear() <= today.getFullYear();
    }
    if (viewMode === "years") {
      return yearPageStart <= today.getFullYear();
    }
    return false;
  };

  const navButtonClass = cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed"
  );

  // Shared header
  const renderHeader = (label: string, onLabelClick?: () => void) => (
    <div className="flex items-center justify-between px-1 pb-3">
      <button type="button" onClick={() => navigateMonth(-1)} disabled={isPrevDisabled()} className={navButtonClass}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      {onLabelClick ? (
        <button
          type="button"
          onClick={onLabelClick}
          className="text-sm font-semibold hover:bg-accent rounded-md px-2.5 py-1 transition-colors"
        >
          {label}
        </button>
      ) : (
        <span className="text-sm font-semibold px-2.5 py-1">{label}</span>
      )}
      <button type="button" onClick={() => navigateMonth(1)} className={navButtonClass}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  // Grid cell renderer
  const renderCell = (
    label: string,
    isSelected: boolean,
    isCurrent: boolean,
    isDisabled: boolean,
    onClick: () => void
  ) => (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-md text-sm font-medium transition-colors h-9",
        isDisabled && "text-muted-foreground/30 cursor-not-allowed",
        !isDisabled && !isSelected && "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
        isCurrent && !isSelected && "bg-accent text-accent-foreground font-semibold"
      )}
    >
      {label}
    </button>
  );

  // Month picker
  if (viewMode === "months") {
    return (
      <div className={cn("p-3 pointer-events-auto select-none w-[252px]", className)}>
        {renderHeader(`${displayMonth.getFullYear()}`, () => {
          setYearPageStart(Math.floor(displayMonth.getFullYear() / 10) * 10);
          setViewMode("years");
        })}
        <div className="grid grid-cols-3 gap-1">
          {MONTH_NAMES_SHORT.map((name, i) => renderCell(
            name,
            i === displayMonth.getMonth(),
            displayMonth.getFullYear() === today.getFullYear() && i === today.getMonth(),
            isMonthDisabled(i),
            () => {
              const next = new Date(displayMonth);
              next.setMonth(i);
              handleMonthChange(next);
              setViewMode("days");
            }
          ))}
        </div>
      </div>
    );
  }

  // Year picker
  if (viewMode === "years") {
    const years = Array.from({ length: 10 }, (_, i) => yearPageStart + i);
    return (
      <div className={cn("p-3 pointer-events-auto select-none w-[252px]", className)}>
        {renderHeader(`${yearPageStart} – ${yearPageStart + 9}`)}
        <div className="grid grid-cols-3 gap-1">
          {years.map((year) => renderCell(
            String(year),
            year === displayMonth.getFullYear(),
            year === today.getFullYear(),
            isYearDisabled(year),
            () => {
              const next = new Date(displayMonth);
              next.setFullYear(year);
              if (disablePastDates && year === today.getFullYear() && next.getMonth() < today.getMonth()) {
                next.setMonth(today.getMonth());
              }
              handleMonthChange(next);
              setViewMode("months");
            }
          ))}
        </div>
      </div>
    );
  }

  // Days view
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      month={displayMonth}
      onMonthChange={handleMonthChange}
      disabled={disabled}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal rounded-full transition-colors duration-150 aria-selected:opacity-100 hover:bg-accent/80 hover:text-accent-foreground"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground rounded-full hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-sm",
        day_today: "bg-accent text-accent-foreground font-semibold rounded-full",
        day_outside:
          "day-outside text-muted-foreground opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-25 hover:bg-transparent hover:text-muted-foreground cursor-not-allowed",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        CaptionLabel: ({ displayMonth: dm }) => (
          <button
            type="button"
            onClick={() => setViewMode("months")}
            className="text-sm font-semibold hover:bg-accent rounded-md px-2.5 py-1 transition-colors"
          >
            {MONTH_NAMES_SHORT[dm.getMonth()]} {dm.getFullYear()}
          </button>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
