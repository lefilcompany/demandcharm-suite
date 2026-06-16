import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDemandCard } from "@/components/CalendarDemandCard";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const SKIP_MOVE_CONFIRM_KEY = "skip-calendar-move-confirm";

interface Demand {
  id: string;
  title: string;
  priority?: string | null;
  due_date?: string | null;
  demand_statuses?: {
    name: string;
    color: string;
  } | null;
  services?: {
    id: string;
    name: string;
  } | null;
}

interface DemandsCalendarViewProps {
  demands: Demand[];
  onDemandClick: (demandId: string) => void;
  onDayClick: (date: Date) => void;
  isRequester?: boolean;
  onDemandDateChange?: (demandId: string, newDate: Date) => Promise<void>;
  initialDate?: Date;
  onDateChange?: (date: Date) => void;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MAX_VISIBLE_DEMANDS_MONTH_MOBILE = 1;
const MAX_VISIBLE_DEMANDS_MONTH = 3;
const MAX_VISIBLE_DEMANDS_WEEK = 5;

type CalendarViewMode = "day" | "week" | "month";

interface SelectedDaySheet {
  date: Date;
  demands: Demand[];
}

interface DragDropConfirmation {
  demand: Demand;
  fromDate: Date;
  toDate: Date;
}

export function DemandsCalendarView({
  demands,
  onDemandClick,
  onDayClick,
  isRequester = false,
  onDemandDateChange,
  initialDate,
  onDateChange,
}: DemandsCalendarViewProps) {
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDateRaw] = useState(initialDate || new Date());
  const setCurrentDate = useCallback((date: Date) => {
    setCurrentDateRaw(date);
    onDateChange?.(date);
  }, [onDateChange]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDaySheet, setSelectedDaySheet] = useState<SelectedDaySheet | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragConfirmation, setDragConfirmation] = useState<DragDropConfirmation | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Group demands by date
  const demandsByDate = useMemo(() => {
    const grouped: Record<string, Demand[]> = {};
    demands.forEach((demand) => {
      if (demand.due_date) {
        const dateKey = demand.due_date.substring(0, 10);
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(demand);
      }
    });
    return grouped;
  }, [demands]);

  // Generate calendar days based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === "day") {
      return [startOfDay(currentDate)];
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: startDate, end: endDate });
    }
  }, [currentDate, viewMode]);

  // Navigation handlers
  const goToPrevious = () => {
    if (viewMode === "day") {
      setCurrentDate(subDays(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, demand: Demand) => {
    e.dataTransfer.setData("application/json", JSON.stringify(demand));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    try {
      const demand: Demand = JSON.parse(e.dataTransfer.getData("application/json"));
      if (!demand.due_date) return;
      const fromDate = new Date(demand.due_date);
      if (isSameDay(fromDate, targetDate)) return;
      if (localStorage.getItem(SKIP_MOVE_CONFIRM_KEY) === "true") {
        handleDirectMove(demand.id, targetDate);
      } else {
        setDragConfirmation({ demand, fromDate, toDate: targetDate });
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDirectMove = async (demandId: string, toDate: Date) => {
    if (!onDemandDateChange) return;
    setIsMoving(true);
    try {
      await onDemandDateChange(demandId, toDate);
      toast.success("Data da demanda atualizada com sucesso");
    } catch {
      toast.error("Erro ao mover demanda");
    } finally {
      setIsMoving(false);
    }
  };

  const [dontAskMove, setDontAskMove] = useState(false);

  const handleConfirmMove = async () => {
    if (!dragConfirmation || !onDemandDateChange) return;
    if (dontAskMove) {
      localStorage.setItem(SKIP_MOVE_CONFIRM_KEY, "true");
    }
    setIsMoving(true);
    try {
      await onDemandDateChange(dragConfirmation.demand.id, dragConfirmation.toDate);
      toast.success("Data da demanda atualizada com sucesso");
    } catch {
      toast.error("Erro ao mover demanda");
    } finally {
      setIsMoving(false);
      setDragConfirmation(null);
    }
  };

  // Get header title based on view mode
  const getHeaderTitle = () => {
    if (viewMode === "day") {
      if (isMobile) {
        return format(currentDate, "d MMM yyyy", { locale: ptBR });
      }
      return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (isMobile) {
        return `${format(weekStart, "d", { locale: ptBR })} - ${format(weekEnd, "d MMM", { locale: ptBR })}`;
      }
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, "d", { locale: ptBR })} - ${format(weekEnd, "d 'de' MMMM yyyy", { locale: ptBR })}`;
      }
      return `${format(weekStart, "d MMM", { locale: ptBR })} - ${format(weekEnd, "d MMM yyyy", { locale: ptBR })}`;
    } else {
      if (isMobile) {
        return format(currentDate, "MMM yyyy", { locale: ptBR });
      }
      return format(currentDate, "MMMM yyyy", { locale: ptBR });
    }
  };

  const renderDayView = () => {
    const day = calendarDays[0];
    const dateKey = format(day, "yyyy-MM-dd");
    const dayDemands = demandsByDate[dateKey] || [];
    const today = startOfDay(new Date());
    const isPastDay = isBefore(day, today);

    return (
      <div className="min-h-[500px] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            {dayDemands.length} {dayDemands.length === 1 ? "demanda" : "demandas"}
          </h3>
          {!isPastDay && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDayClick(day)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {isRequester ? "Nova solicitação" : "Nova demanda"}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[450px]">
          <div className="space-y-2">
            {dayDemands.length === 0 ? (
              isPastDay ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <p>Nenhuma demanda para este dia</p>
                </div>
              ) : (
                <div 
                  className="flex flex-col items-center justify-center h-[300px] text-muted-foreground cursor-pointer hover:bg-muted/30 rounded-lg transition-colors"
                  onClick={() => onDayClick(day)}
                >
                  <Plus className="h-8 w-8 mb-2" />
                  <p>Nenhuma demanda para este dia</p>
                  <p className="text-sm">Clique para {isRequester ? "solicitar" : "adicionar"}</p>
                </div>
              )
            ) : (
              dayDemands.map((demand) => (
                <div key={demand.id} className="p-2 border rounded-lg hover:bg-muted/30 transition-colors">
                  <CalendarDemandCard
                    demand={demand}
                    onClick={() => onDemandClick(demand.id)}
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderWeekView = () => {
    const today = startOfDay(new Date());

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[500px] sm:min-w-0">
          <div className="grid grid-cols-7">
            {/* Weekday Headers */}
            {WEEKDAYS_FULL.map((day, index) => (
              <div
                key={day}
                className="py-1.5 sm:py-2 px-0.5 sm:px-1 text-center text-[10px] sm:text-xs font-medium text-muted-foreground border-b border-border"
              >
                <span className="hidden md:inline">{day}</span>
                <span className="hidden sm:inline md:hidden">{WEEKDAYS_SHORT[index]}</span>
                <span className="sm:hidden">{WEEKDAYS[index]}</span>
              </div>
            ))}

            {/* Week Days */}
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayDemands = demandsByDate[dateKey] || [];
              const isTodayDate = isToday(day);
              const isPastDay = isBefore(day, today);
              const maxVisible = isMobile ? 2 : MAX_VISIBLE_DEMANDS_WEEK;
              const hasMoreDemands = dayDemands.length > maxVisible;
              const visibleDemands = dayDemands.slice(0, maxVisible);
              const hiddenCount = dayDemands.length - maxVisible;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "min-h-[120px] sm:min-h-[200px] border-b border-r border-border p-0.5 sm:p-2 transition-colors",
                    !isPastDay && "hover:bg-muted/30 cursor-pointer",
                    isPastDay && "bg-muted/10 opacity-70",
                    dragOverDate === dateKey && "bg-primary/10 ring-2 ring-primary/40"
                  )}
                  onClick={() => !isPastDay && onDayClick(day)}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span
                      className={cn(
                        "text-xs sm:text-sm font-medium w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full",
                        isTodayDate && "bg-primary text-primary-foreground font-bold",
                        isPastDay && "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayDemands.length > 0 && (
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {dayDemands.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 sm:space-y-1">
                    {visibleDemands.map((demand) => (
                      <div
                        key={demand.id}
                        draggable={!!onDemandDateChange && !!demand.due_date}
                        onDragStart={(e) => handleDragStart(e, demand)}
                        className={cn(onDemandDateChange && demand.due_date && "cursor-grab active:cursor-grabbing")}
                      >
                        <CalendarDemandCard
                          demand={demand}
                          onClick={() => onDemandClick(demand.id)}
                          compact={isMobile}
                        />
                      </div>
                    ))}

                    {hasMoreDemands && (
                      <button
                        className="w-full text-[10px] sm:text-xs text-primary hover:text-primary/80 font-medium py-0.5 sm:py-1 hover:bg-primary/5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDaySheet({ date: day, demands: dayDemands });
                        }}
                      >
                        +{hiddenCount}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const today = startOfDay(new Date());
    const maxVisibleMobile = MAX_VISIBLE_DEMANDS_MONTH_MOBILE;
    const maxVisibleDesktop = MAX_VISIBLE_DEMANDS_MONTH;

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[320px] sm:min-w-0">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/20">
            {WEEKDAYS.map((day, index) => (
              <div
                key={index}
                className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-muted-foreground"
              >
                <span className="sm:hidden">{day}</span>
                <span className="hidden sm:inline">{WEEKDAYS_SHORT[index]}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayDemands = demandsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              const isPastDay = isBefore(day, today);
              const maxVisible = isMobile ? maxVisibleMobile : maxVisibleDesktop;
              const hasMoreDemands = dayDemands.length > maxVisible;
              const visibleDemands = dayDemands.slice(0, maxVisible);
              const hiddenCount = dayDemands.length - maxVisible;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "min-h-[70px] sm:min-h-[120px] md:min-h-[140px] border-b border-r border-border p-0.5 sm:p-1 md:p-2 transition-colors",
                    !isPastDay && "hover:bg-muted/30 cursor-pointer",
                    !isCurrentMonth && "bg-muted/10 text-muted-foreground",
                    isPastDay && "bg-muted/10 opacity-70",
                    index % 7 === 0 && "border-l-0",
                    index < 7 && "border-t-0",
                    dragOverDate === dateKey && "bg-primary/10 ring-2 ring-primary/40"
                  )}
                  onClick={() => {
                    if (isMobile && dayDemands.length > 0) {
                      setSelectedDaySheet({ date: day, demands: dayDemands });
                    } else if (!isPastDay) {
                      onDayClick(day);
                    }
                  }}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  {/* Day Number */}
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span
                      className={cn(
                        "text-[10px] sm:text-sm font-medium w-4 h-4 sm:w-7 sm:h-7 flex items-center justify-center rounded-full",
                        isTodayDate &&
                          "bg-primary text-primary-foreground font-bold",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isPastDay && "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayDemands.length > 0 && (
                      <>
                        <span className="text-[9px] text-muted-foreground sm:hidden">
                          {dayDemands.length}
                        </span>
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {dayDemands.length}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Demands List */}
                  <div className="space-y-0.5 sm:space-y-1">
                    {visibleDemands.map((demand) => (
                      <div
                        key={demand.id}
                        draggable={!!onDemandDateChange && !!demand.due_date}
                        onDragStart={(e) => handleDragStart(e, demand)}
                        className={cn(onDemandDateChange && demand.due_date && "cursor-grab active:cursor-grabbing")}
                      >
                        <CalendarDemandCard
                          demand={demand}
                          onClick={() => onDemandClick(demand.id)}
                          compact={isMobile}
                        />
                      </div>
                    ))}

                    {/* More demands indicator */}
                    {hasMoreDemands && (
                      <button
                        className="w-full text-[9px] sm:text-xs text-primary hover:text-primary/80 font-medium py-0.5 hover:bg-primary/5 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDaySheet({ date: day, demands: dayDemands });
                        }}
                      >
                        +{hiddenCount}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-4 border-b border-border bg-muted/30">
        {/* Navigation Controls */}
        <div className="flex items-center gap-1 sm:gap-2 order-2 sm:order-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevious}
            className="h-7 w-7 sm:h-8 sm:w-8"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNext}
            className="h-7 w-7 sm:h-8 sm:w-8"
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToToday}
            className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
          >
            Hoje
          </Button>
        </div>

        {/* Title */}
        <h2 className="text-sm sm:text-lg font-semibold text-foreground capitalize order-1 sm:order-2 w-full sm:w-auto text-center">
          {getHeaderTitle()}
        </h2>

        {/* View Toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as CalendarViewMode)}
          className="bg-muted/50 rounded-md p-0.5 sm:p-1 order-3"
        >
          <ToggleGroupItem 
            value="day" 
            aria-label="Visão diária" 
            className="text-[10px] sm:text-xs px-2 sm:px-3 h-6 sm:h-8"
          >
            Dia
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="week" 
            aria-label="Visão semanal" 
            className="text-[10px] sm:text-xs px-2 sm:px-3 h-6 sm:h-8"
          >
            Sem
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="month" 
            aria-label="Visão mensal" 
            className="text-[10px] sm:text-xs px-2 sm:px-3 h-6 sm:h-8"
          >
            Mês
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Calendar Content */}
      {viewMode === "day" && renderDayView()}
      {viewMode === "week" && renderWeekView()}
      {viewMode === "month" && renderMonthView()}

      {/* Side Sheet for more demands */}
      <Sheet open={!!selectedDaySheet} onOpenChange={(open) => !open && setSelectedDaySheet(null)}>
        <SheetContent side="right" className="w-full sm:w-[400px] md:w-[480px] p-0 flex flex-col">
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-border bg-muted/30 shrink-0">
            <SheetHeader className="mb-0">
              <SheetTitle className="capitalize text-sm sm:text-lg font-semibold">
                {selectedDaySheet && format(selectedDaySheet.date, isMobile ? "EEE, d 'de' MMM" : "EEEE, d 'de' MMMM", { locale: ptBR })}
              </SheetTitle>
            </SheetHeader>
            <div className="flex items-center justify-between mt-2 sm:mt-3 gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                {selectedDaySheet?.demands.length} {selectedDaySheet?.demands.length === 1 ? "demanda" : "demandas"}
              </span>
              {selectedDaySheet && !isBefore(selectedDaySheet.date, startOfDay(new Date())) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    if (selectedDaySheet) {
                      onDayClick(selectedDaySheet.date);
                      setSelectedDaySheet(null);
                    }
                  }}
                  className="gap-1.5 h-8 px-3 text-xs sm:text-sm"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{isRequester ? "Nova solicitação" : "Nova demanda"}</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              )}
            </div>
          </div>

          {/* Demands List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              {selectedDaySheet?.demands.map((demand) => (
                <div 
                  key={demand.id} 
                  className="p-2.5 sm:p-3 border border-border/60 rounded-lg hover:bg-muted/40 hover:border-border transition-all cursor-pointer bg-card shadow-sm"
                  onClick={() => {
                    onDemandClick(demand.id);
                    setSelectedDaySheet(null);
                  }}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    {/* Status indicator */}
                    <div 
                      className="w-1 sm:w-1.5 h-full min-h-[40px] rounded-full shrink-0"
                      style={{ backgroundColor: demand.demand_statuses?.color || '#94a3b8' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm text-foreground line-clamp-2 mb-1">
                        {demand.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {demand.demand_statuses && (
                          <span 
                            className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${demand.demand_statuses.color}15`,
                              color: demand.demand_statuses.color,
                            }}
                          >
                            {demand.demand_statuses.name}
                          </span>
                        )}
                        {demand.priority && (
                          <span className={cn(
                            "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium",
                            demand.priority === "alta" && "bg-destructive/10 text-destructive",
                            demand.priority === "média" && "bg-warning/10 text-warning",
                            demand.priority === "baixa" && "bg-success/10 text-success"
                          )}>
                            {demand.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {selectedDaySheet?.demands.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <p className="text-sm">Nenhuma demanda para este dia</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Drag and drop confirmation dialog */}
      <AlertDialog open={!!dragConfirmation} onOpenChange={(open) => !open && setDragConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja mover a demanda <strong className="text-foreground">"{dragConfirmation?.demand.title}"</strong> de{" "}
              <strong className="text-foreground">
                {dragConfirmation && format(dragConfirmation.fromDate, "d 'de' MMMM", { locale: ptBR })}
              </strong>{" "}
              para{" "}
              <strong className="text-foreground">
                {dragConfirmation && format(dragConfirmation.toDate, "d 'de' MMMM", { locale: ptBR })}
              </strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-6 pb-2">
            <Checkbox id="skip-move-confirm" checked={dontAskMove} onCheckedChange={(v) => setDontAskMove(!!v)} />
            <label htmlFor="skip-move-confirm" className="text-xs text-muted-foreground cursor-pointer">Não perguntar novamente</label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMoving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMove} disabled={isMoving}>
              {isMoving ? "Movendo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
