import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Briefcase, Calendar as CalendarIcon, Flag, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDateOverdue } from "@/lib/dateUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CalendarDemandCardProps {
  demand: {
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
  };
  onClick?: () => void;
  compact?: boolean;
}

const priorityIndicatorColors = {
  baixa: "bg-success",
  média: "bg-warning",
  alta: "bg-destructive",
};

const priorityLabels: Record<string, string> = {
  baixa: "Baixa",
  média: "Média",
  alta: "Alta",
};

const priorityTextColors: Record<string, string> = {
  baixa: "text-success",
  média: "text-warning",
  alta: "text-destructive",
};

function CardTooltip({
  demand,
  isDelivered,
  isOverdue,
  children,
}: {
  demand: CalendarDemandCardProps["demand"];
  isDelivered: boolean;
  isOverdue: boolean;
  children: React.ReactNode;
}) {
  const dueDateLabel = demand.due_date
    ? format(new Date(demand.due_date), "dd 'de' MMM, yyyy", { locale: ptBR })
    : null;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-w-[280px] p-0 overflow-hidden border border-border shadow-2xl text-foreground"
          style={{
            backgroundColor: "hsl(var(--background))",
            backgroundImage: "linear-gradient(hsl(var(--background)), hsl(var(--background)))",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            opacity: 1,
            isolation: "isolate",
          }}
        >
          {/* Color bar from status */}
          {demand.demand_statuses && (
            <div
              className="h-1 w-full"
              style={{ backgroundColor: demand.demand_statuses.color }}
            />
          )}
          <div className="p-3 space-y-2.5">
            {/* Title */}
            <p className="font-semibold text-sm leading-snug text-foreground">
              {demand.title}
            </p>

            {/* Status + Priority row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {demand.demand_statuses && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 gap-1 font-medium"
                  style={{
                    backgroundColor: `${demand.demand_statuses.color}15`,
                    color: demand.demand_statuses.color,
                    borderColor: `${demand.demand_statuses.color}40`,
                  }}
                >
                  <CircleDot className="h-2.5 w-2.5" />
                  {demand.demand_statuses.name}
                </Badge>
              )}
              {demand.priority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-5 gap-1 font-medium border-current/30 bg-current/10",
                    priorityTextColors[demand.priority]
                  )}
                >
                  <Flag className="h-2.5 w-2.5" />
                  {priorityLabels[demand.priority] ?? demand.priority}
                </Badge>
              )}
            </div>

            {/* Service */}
            {demand.services?.name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{demand.services.name}</span>
              </div>
            )}

            {/* Due date */}
            {dueDateLabel && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3 shrink-0" />
                <span>
                  {isOverdue ? "Vencida em " : "Vence em "}
                  {dueDateLabel}
                </span>
              </div>
            )}

            {/* Delivered hint */}
            {isDelivered && (
              <div className="text-[11px] text-success font-medium pt-0.5 border-t border-border/60">
                ✓ Demanda entregue
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CalendarDemandCard({ demand, onClick, compact = false }: CalendarDemandCardProps) {
  const isHighPriority = demand.priority === "alta";
  const statusName = demand.demand_statuses?.name;
  const isDelivered = statusName === "Entregue";
  const isOverdue = !isDelivered && isDateOverdue(demand.due_date);

  if (compact) {
    return (
      <CardTooltip demand={demand} isDelivered={isDelivered} isOverdue={isOverdue}>
        <div
          className={cn(
            "relative px-1.5 py-1 rounded text-[9px] cursor-pointer transition-all truncate",
            "hover:ring-1 hover:ring-primary/50",
            isDelivered && "opacity-60",
            isOverdue && "ring-1 ring-destructive/50 bg-destructive/10",
            !isOverdue && !isDelivered && "bg-muted/60"
          )}
          style={{
            borderLeft: demand.demand_statuses
              ? `3px solid ${demand.demand_statuses.color}`
              : undefined
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <span className="font-medium text-foreground truncate block">
            {demand.title}
          </span>
        </div>
      </CardTooltip>
    );
  }

  return (
    <CardTooltip demand={demand} isDelivered={isDelivered} isOverdue={isOverdue}>
      <div
        className={cn(
          "group relative px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all",
          "hover:ring-1 hover:ring-primary/50 hover:shadow-sm",
          isDelivered && "opacity-60",
          isOverdue && "ring-1 ring-destructive/50 bg-destructive/5",
          !isOverdue && !isDelivered && "bg-muted/50 hover:bg-muted"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        {/* Priority indicator */}
        {demand.priority && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 rounded-l-md",
              priorityIndicatorColors[demand.priority as keyof typeof priorityIndicatorColors]
            )}
          />
        )}

        <div className="flex items-start gap-1.5 pl-1">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-foreground">
              {demand.title}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {demand.demand_statuses && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4"
                  style={{
                    backgroundColor: `${demand.demand_statuses.color}15`,
                    color: demand.demand_statuses.color,
                    borderColor: `${demand.demand_statuses.color}30`,
                  }}
                >
                  {demand.demand_statuses.name}
                </Badge>
              )}
              {demand.services?.name && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 gap-0.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
                >
                  <Briefcase className="h-2.5 w-2.5" />
                  {demand.services.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isHighPriority && (
              <AlertTriangle className="h-3 w-3 text-destructive" />
            )}
            {isOverdue && (
              <Clock className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>
      </div>
    </CardTooltip>
  );
}
