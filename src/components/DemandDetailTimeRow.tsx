import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { BoardTimeEntry } from "@/hooks/useBoardTimeEntries";
import { cn, truncateText } from "@/lib/utils";

interface GroupedByDemand {
  demand: BoardTimeEntry["demand"];
  entries: BoardTimeEntry[];
  totalSeconds: number;
  users: Map<string, { profile: BoardTimeEntry["profile"]; totalSeconds: number }>;
  hasActiveTimer: boolean;
}

interface DemandDetailTimeRowProps {
  demandData: GroupedByDemand;
  isExpanded: boolean;
  onToggle: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  urgente: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  alta: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-white",
  média: "bg-yellow-500 text-white",
  media: "bg-yellow-500 text-white",
  low: "bg-green-500 text-white",
  baixa: "bg-green-500 text-white",
};

// Component for displaying live time for a specific user in a demand
function UserLiveTime({
  userId,
  totalSeconds,
  entries,
}: {
  userId: string;
  totalSeconds: number;
  entries: BoardTimeEntry[];
}) {
  // Find active entry for this user
  const activeEntry = entries.find(e => e.user_id === userId && !e.ended_at);
  const hasActive = !!activeEntry;

  const liveTime = useLiveTimer({
    isActive: hasActive,
    baseSeconds: totalSeconds,
    lastStartedAt: activeEntry?.started_at || null,
  });

  return (
    <span className={cn(
      "font-mono",
      hasActive && "text-emerald-600 dark:text-emerald-400"
    )}>
      {liveTime || formatTimeDisplay(totalSeconds) || "00:00:00:00"}
    </span>
  );
}

export function DemandDetailTimeRow({ demandData, isExpanded, onToggle }: DemandDetailTimeRowProps) {
  const navigate = useNavigate();

  // Find the active entry for this demand to get lastStartedAt
  const activeEntry = demandData.entries.find(e => !e.ended_at);

  // Use live timer for demand total time
  const liveTime = useLiveTimer({
    isActive: demandData.hasActiveTimer,
    baseSeconds: demandData.totalSeconds,
    lastStartedAt: activeEntry?.started_at || null,
  });

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-3 text-left flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/demands/${demandData.demand.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        navigate(`/demands/${demandData.demand.id}`);
                      }
                    }}
                    className="font-medium truncate hover:text-primary hover:underline cursor-pointer transition-colors"
                    title={demandData.demand.title}
                  >
                    {truncateText(demandData.demand.title)}
                  </span>
                  {demandData.hasActiveTimer && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] h-5">
                      <Play className="h-2.5 w-2.5 mr-0.5 fill-current" />
                      Timer Ativo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: demandData.demand.status?.color,
                      color: demandData.demand.status?.color,
                    }}
                  >
                    {demandData.demand.status?.name || "—"}
                  </Badge>
                  {demandData.demand.priority && (
                    <Badge className={priorityColors[demandData.demand.priority.toLowerCase()] || "bg-muted"}>
                      {demandData.demand.priority}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {demandData.users.size} usuário{demandData.users.size !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-mono font-bold",
                demandData.hasActiveTimer && "text-emerald-600 dark:text-emerald-400"
              )}>
                {liveTime || formatTimeDisplay(demandData.totalSeconds) || "00:00:00:00"}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-muted/30 p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(demandData.users.entries()).map(([userId, { profile, totalSeconds }]) => {
                  const hasActive = demandData.entries.some(e => e.user_id === userId && !e.ended_at);
                  return (
                    <TableRow key={userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={profile.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {profile.full_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {hasActive && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full animate-pulse" />
                            )}
                          </div>
                          <span className="font-medium">{profile.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserLiveTime
                          userId={userId}
                          totalSeconds={totalSeconds}
                          entries={demandData.entries}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link to={`/user/${userId}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
