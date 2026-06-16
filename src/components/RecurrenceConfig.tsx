import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Repeat, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecurrenceData {
  enabled: boolean;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  weekdays: number[];
  dayOfMonth: number | null;
  startDate: string;
  endDate: string;
}

interface RecurrenceConfigProps {
  value: RecurrenceData;
  onChange: (data: RecurrenceData) => void;
  compact?: boolean;
}

const WEEKDAY_LABELS = [
  { value: 0, label: "Dom", short: "D" },
  { value: 1, label: "Seg", short: "S" },
  { value: 2, label: "Ter", short: "T" },
  { value: 3, label: "Qua", short: "Q" },
  { value: 4, label: "Qui", short: "Q" },
  { value: 5, label: "Sex", short: "S" },
  { value: 6, label: "Sáb", short: "S" },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

export const defaultRecurrenceData: RecurrenceData = {
  enabled: false,
  frequency: "daily",
  weekdays: [1, 2, 3, 4, 5],
  dayOfMonth: Math.min(new Date().getDate(), 28),
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
};

function parseLocalDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function RecurrenceConfig({ value, onChange, compact = false }: RecurrenceConfigProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const update = (partial: Partial<RecurrenceData>) => {
    onChange({ ...value, ...partial });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = parseLocalDate(value.startDate);
  const endDate = parseLocalDate(value.endDate);

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3.5 bg-muted/30 transition-colors hover:bg-muted/50">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Repeat className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label htmlFor="recurrence-toggle" className="text-sm font-medium cursor-pointer">
              Repetir demanda
            </Label>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Criar automaticamente de forma recorrente
              </p>
            )}
          </div>
        </div>
        <Switch
          id="recurrence-toggle"
          checked={value.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
        />
      </div>

      {value.enabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between text-left font-normal rounded-lg h-10 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 group"
            >
              <span className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="font-medium text-foreground">
                  {value.frequency === "daily" && "Diária"}
                  {value.frequency === "weekly" && "Semanal"}
                  {value.frequency === "biweekly" && "Quinzenal"}
                  {value.frequency === "monthly" && `Mensal (dia ${value.dayOfMonth || 1})`}
                </span>
                {startDate && (
                  <span className="text-muted-foreground">
                    · a partir de {format(startDate, "dd/MM/yy", { locale: ptBR })}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium text-primary/70 group-hover:text-primary transition-colors">Configurar</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start" side="top">
            <div className="p-4 space-y-4">
              {/* Frequency */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Frequência
                </Label>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/50 rounded-lg">
                  {[
                    { value: "daily" as const, label: "Diária" },
                    { value: "weekly" as const, label: "Semanal" },
                    { value: "biweekly" as const, label: "Quinz." },
                    { value: "monthly" as const, label: "Mensal" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update({ frequency: opt.value })}
                      className={cn(
                        "px-2 py-2 text-xs font-medium rounded-md transition-all duration-150 text-center",
                        value.frequency === opt.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly/Biweekly: weekday selector */}
              {(value.frequency === "weekly" || value.frequency === "biweekly") && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dias da semana
                  </Label>
                  <div className="flex gap-1.5">
                    {WEEKDAY_LABELS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const newDays = value.weekdays.includes(day.value)
                            ? value.weekdays.filter((d) => d !== day.value)
                            : [...value.weekdays, day.value].sort();
                          update({ weekdays: newDays });
                        }}
                        className={cn(
                          "flex-1 aspect-square max-w-9 flex items-center justify-center rounded-full text-xs font-semibold transition-all duration-150",
                          value.weekdays.includes(day.value)
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={day.label}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly: day of month grid */}
              {value.frequency === "monthly" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dia do mês
                  </Label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_OF_MONTH.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const targetMonth = day >= now.getDate() ? now.getMonth() : now.getMonth() + 1;
                          const targetYear = targetMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
                          const normalizedMonth = targetMonth % 12;
                          const newStart = `${targetYear}-${String(normalizedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const updates: Partial<RecurrenceData> = { dayOfMonth: day, startDate: newStart };
                          if (value.endDate && value.endDate < newStart) {
                            updates.endDate = "";
                          }
                          update(updates);
                        }}
                        className={cn(
                          "h-8 w-full rounded-full text-xs font-medium transition-colors duration-150 text-center",
                          (value.dayOfMonth || 1) === day
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/50 text-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Início *
                  </Label>
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal rounded-lg h-9 text-xs",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                        {startDate
                          ? format(startDate, "dd/MM/yy", { locale: ptBR })
                          : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="top">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date) {
                            const newStart = toLocalDateStr(date);
                            const updates: Partial<RecurrenceData> = { startDate: newStart };
                            if (value.endDate && value.endDate < newStart) {
                              updates.endDate = "";
                            }
                            update(updates);
                          }
                          setStartOpen(false);
                        }}
                        disabled={(date) => {
                          const d = new Date(date);
                          d.setHours(0, 0, 0, 0);
                          return d < today;
                        }}
                        disablePastDates
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fim (opcional)
                  </Label>
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal rounded-lg h-9 text-xs",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                        {endDate
                          ? format(endDate, "dd/MM/yy", { locale: ptBR })
                          : "Sem fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="top">
                      <div className="flex flex-col">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            if (date) {
                              update({ endDate: toLocalDateStr(date) });
                            }
                            setEndOpen(false);
                          }}
                          disabled={(date) => {
                            const d = new Date(date);
                            d.setHours(0, 0, 0, 0);
                            const minDate = startDate || today;
                            return d < minDate;
                          }}
                          disablePastDates
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                        {value.endDate && (
                          <div className="px-3 pb-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full text-destructive hover:text-destructive"
                              onClick={() => {
                                update({ endDate: "" });
                                setEndOpen(false);
                              }}
                            >
                              Remover data de fim
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Info text */}
              <div className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {value.frequency === "daily" && "Nova demanda todos os dias úteis (seg-sex)."}
                  {value.frequency === "weekly" &&
                    (value.weekdays.length > 0
                      ? `Criação semanal: ${value.weekdays
                          .sort()
                          .map((d) => WEEKDAY_LABELS.find((l) => l.value === d)?.label)
                          .join(", ")}`
                      : "Selecione pelo menos um dia.")}
                  {value.frequency === "biweekly" &&
                    (value.weekdays.length > 0
                      ? `A cada 2 semanas: ${value.weekdays
                          .sort()
                          .map((d) => WEEKDAY_LABELS.find((l) => l.value === d)?.label)
                          .join(", ")}`
                      : "Selecione pelo menos um dia.")}
                  {value.frequency === "monthly" &&
                    `Todo dia ${value.dayOfMonth || 1} de cada mês.`}
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
