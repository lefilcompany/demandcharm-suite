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
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
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

const WEEKEND_OPTIONS = [
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export const defaultRecurrenceData: RecurrenceData = {
  enabled: false,
  frequency: "daily",
  weekdays: [6],
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
  const [recurrenceDateOpen, setRecurrenceDateOpen] = useState(false);

  const update = (partial: Partial<RecurrenceData>) => {
    onChange({ ...value, ...partial });
  };

  const handleFrequencyChange = (frequency: RecurrenceData["frequency"]) => {
    const updates: Partial<RecurrenceData> = { frequency };
    // For weekend-only frequencies, ensure a single weekend day is selected
    if (frequency === "weekly" || frequency === "biweekly") {
      const hasWeekend = value.weekdays.some((d) => d === 0 || d === 6);
      if (!hasWeekend) {
        updates.weekdays = [6]; // default to Saturday
      } else {
        // keep only the first weekend day selected (single selection)
        const firstWeekend = value.weekdays.find((d) => d === 0 || d === 6);
        updates.weekdays = firstWeekend !== undefined ? [firstWeekend] : [6];
      }
    }
    update(updates);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = parseLocalDate(value.startDate);
  const endDate = parseLocalDate(value.endDate);

  // Anchor date used by the monthly/yearly calendar picker
  const recurrenceAnchor = startDate;

  const showSeparateStartDate = value.frequency === "daily" || value.frequency === "weekly" || value.frequency === "biweekly";

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
                  {value.frequency === "weekly" &&
                    (value.weekdays.length > 0
                      ? `Semanal (${WEEKEND_OPTIONS.find((o) => o.value === value.weekdays[0])?.label || ""})`
                      : "Semanal")}
                  {value.frequency === "biweekly" &&
                    (value.weekdays.length > 0
                      ? `Quinzenal (${WEEKEND_OPTIONS.find((o) => o.value === value.weekdays[0])?.label || ""})`
                      : "Quinzenal")}
                  {value.frequency === "monthly" && `Mensal (dia ${value.dayOfMonth || (startDate?.getDate() ?? 1)})`}
                  {value.frequency === "yearly" && startDate && `Anual (${format(startDate, "dd/MM", { locale: ptBR })})`}
                  {value.frequency === "yearly" && !startDate && "Anual"}
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
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "daily" as const, label: "Diária" },
                    { value: "weekly" as const, label: "Semanal" },
                    { value: "biweekly" as const, label: "Quinzenal" },
                    { value: "monthly" as const, label: "Mensal" },
                    { value: "yearly" as const, label: "Anual" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleFrequencyChange(opt.value)}
                      className={cn(
                        "h-9 px-3 text-xs font-medium rounded-lg border transition-all duration-150 text-center",
                        value.frequency === opt.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly/Biweekly: single weekend-day selector (Sat or Sun only) */}
              {(value.frequency === "weekly" || value.frequency === "biweekly") && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dia da semana
                  </Label>
                  <div className="flex gap-2">
                    {WEEKEND_OPTIONS.map((day) => {
                      const selected = value.weekdays[0] === day.value;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => update({ weekdays: [day.value] })}
                          className={cn(
                            "flex-1 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150",
                            selected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Selecione apenas um dia: sábado ou domingo.
                  </p>
                </div>
              )}

              {/* Monthly/Yearly: calendar day picker */}
              {(value.frequency === "monthly" || value.frequency === "yearly") && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {value.frequency === "monthly" ? "Dia do mês" : "Data anual"}
                  </Label>
                  <Popover open={recurrenceDateOpen} onOpenChange={setRecurrenceDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal rounded-lg h-9 text-xs",
                          !recurrenceAnchor && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                        {recurrenceAnchor
                          ? format(recurrenceAnchor, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" side="top">
                      <Calendar
                        mode="single"
                        selected={recurrenceAnchor}
                        onSelect={(date) => {
                          if (date) {
                            const newStart = toLocalDateStr(date);
                            const updates: Partial<RecurrenceData> = { startDate: newStart };
                            if (value.frequency === "monthly") {
                              updates.dayOfMonth = date.getDate();
                            }
                            if (value.endDate && value.endDate < newStart) {
                              updates.endDate = "";
                            }
                            update(updates);
                          }
                          setRecurrenceDateOpen(false);
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
                  <p className="text-[11px] text-muted-foreground">
                    {value.frequency === "monthly"
                      ? `Nova demanda todo dia ${value.dayOfMonth || (recurrenceAnchor?.getDate() ?? 1)} do mês.`
                      : "Nova demanda uma vez por ano, na data selecionada."}
                  </p>
                </div>
              )}

              {/* Date range */}
              <div className={cn("grid gap-3", showSeparateStartDate ? "grid-cols-2" : "grid-cols-1")}>
                {/* Start Date (only for daily/weekly/biweekly) */}
                {showSeparateStartDate && (
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
                )}

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
                      ? `Criação semanal: ${WEEKEND_OPTIONS.find((o) => o.value === value.weekdays[0])?.label}.`
                      : "Selecione um dia (sábado ou domingo).")}
                  {value.frequency === "biweekly" &&
                    (value.weekdays.length > 0
                      ? `A cada 2 semanas: ${WEEKEND_OPTIONS.find((o) => o.value === value.weekdays[0])?.label}.`
                      : "Selecione um dia (sábado ou domingo).")}
                  {value.frequency === "monthly" &&
                    `Todo dia ${value.dayOfMonth || (recurrenceAnchor?.getDate() ?? 1)} de cada mês.`}
                  {value.frequency === "yearly" &&
                    (recurrenceAnchor
                      ? `Uma vez por ano, em ${format(recurrenceAnchor, "dd 'de' MMMM", { locale: ptBR })}.`
                      : "Selecione a data para definir o dia/mês anual.")}
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
