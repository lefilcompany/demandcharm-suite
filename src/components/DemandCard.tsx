import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, Clock, Wrench, User } from "lucide-react";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { DemandTimeDisplay } from "@/components/DemandTimeDisplay";
import { cn, truncateText } from "@/lib/utils";
import { formatDemandCode } from "@/lib/demandCodeUtils";
import { formatDateOnlyBR, isDemandOverdue, isDemandDeliveredLate } from "@/lib/dateUtils";
import { extractPlainText } from "@/components/ui/rich-text-editor";

interface Assignee {
  user_id: string;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface DemandCardProps {
  demand: {
    id: string;
    title: string;
    description?: string | null;
    priority?: string | null;
    due_date?: string | null;
    delivered_at?: string | null;
    is_overdue?: boolean | null;
    created_at?: string;
    updated_at?: string;
    time_in_progress_seconds?: number | null;
    last_started_at?: string | null;
    board_sequence_number?: number | null;
    service_id?: string | null;
    demand_statuses?: {
      name: string;
      color: string;
    } | null;
    profiles?: {
      full_name: string;
      avatar_url?: string | null;
    } | null;
    assigned_profile?: {
      full_name: string;
      avatar_url?: string | null;
    } | null;
    teams?: {
      name: string;
    } | null;
    services?: {
      id: string;
      name: string;
    } | null;
    demand_assignees?: Assignee[];
  };
  onClick?: () => void;
  showFullDetails?: boolean;
}

const priorityColors = {
  baixa: "bg-success/10 text-success border-success/20",
  média: "bg-warning/10 text-warning border-warning/20",
  alta: "bg-destructive/10 text-destructive border-destructive/20",
};

export function DemandCard({ demand, onClick, showFullDetails = false }: DemandCardProps) {
  const assignees = demand.demand_assignees || [];
  const isHighPriority = demand.priority === "alta";
  const statusName = demand.demand_statuses?.name;
  const isInProgress = statusName === "Fazendo";
  const isDelivered = statusName === "Entregue";
  
  // "Atrasada" only applies while NOT delivered. Once delivered, use the discreet
  // "entregue com atraso" badge instead.
  const isOverdue = isDemandOverdue(demand);
  const isDeliveredLate = isDemandDeliveredLate(demand);
  
  // Fallback to assigned_profile if no assignees
  const displayAssignees = assignees.length > 0 
    ? assignees 
    : demand.assigned_profile 
      ? [{ user_id: "legacy", profile: { full_name: demand.assigned_profile.full_name, avatar_url: demand.assigned_profile.avatar_url || null } }]
      : [];

  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-all cursor-pointer overflow-hidden w-full max-w-full",
        isHighPriority && "border-l-4 border-l-destructive"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {demand.board_sequence_number && (
                <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-muted-foreground/20 font-mono shrink-0">
                  {formatDemandCode(demand.board_sequence_number)}
                </Badge>
              )}
              {isHighPriority && (
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
            </div>
            <CardTitle className="text-base sm:text-lg line-clamp-2" title={demand.title}>{truncateText(demand.title)}</CardTitle>
            {demand.description && (
              <CardDescription className="line-clamp-2 text-sm">
                {extractPlainText(demand.description)}
              </CardDescription>
            )}
          </div>
          {demand.demand_statuses && (
            <Badge
              className="shrink-0 text-xs"
              style={{
                backgroundColor: `${demand.demand_statuses.color}20`,
                color: demand.demand_statuses.color,
                borderColor: `${demand.demand_statuses.color}40`,
              }}
            >
              {demand.demand_statuses.name}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          {demand.priority && (
            <Badge
              variant="outline"
              className={cn("text-xs", priorityColors[demand.priority as keyof typeof priorityColors] || "")}
            >
              {demand.priority.charAt(0).toUpperCase() + demand.priority.slice(1)}
            </Badge>
          )}
          {demand.teams?.name && (
            <Badge variant="secondary" className="text-xs">
              {demand.teams.name}
            </Badge>
          )}
          {/* Service tag */}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs flex items-center gap-1",
              demand.services?.name 
                ? "bg-primary/5 text-primary border-primary/20" 
                : "bg-muted/50 text-muted-foreground border-muted-foreground/20"
            )}
          >
            <Wrench className="h-3 w-3" />
            {demand.services?.name || "Nenhum serviço"}
          </Badge>
        </div>

        {/* Creator and Date info */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {demand.profiles?.full_name && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span className="truncate max-w-[120px]" title={demand.profiles.full_name}>
                {demand.profiles.full_name}
              </span>
            </div>
          )}
          {demand.due_date && (
            <div className={cn(
              "flex items-center gap-1",
              isOverdue && "text-destructive font-medium"
            )}>
              {isOverdue ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
              <span>{formatDateOnlyBR(demand.due_date)}</span>
            </div>
          )}
          {isDeliveredLate && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-5 bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              Entregue com atraso
            </Badge>
          )}
        </div>

        {/* Execution time - show for in progress or delivered */}
        {showFullDetails && (isInProgress || isDelivered) && (
          <DemandTimeDisplay
            createdAt={demand.created_at}
            updatedAt={demand.updated_at}
            timeInProgressSeconds={demand.time_in_progress_seconds}
            lastStartedAt={demand.last_started_at}
            isInProgress={isInProgress}
            isDelivered={isDelivered}
            variant="card"
          />
        )}

        {/* Assignees row */}
        {displayAssignees.length > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Responsáveis:</span>
            <AssigneeAvatars assignees={displayAssignees} size="sm" maxVisible={4} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
