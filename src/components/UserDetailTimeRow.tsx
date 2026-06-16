import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { BoardTimeEntry, BoardUserTimeStats } from "@/hooks/useBoardTimeEntries";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";

interface UserDetailTimeRowProps {
  userData: BoardUserTimeStats & { entries: BoardTimeEntry[] };
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

function truncateText(text: string, maxLength = 40): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Component for displaying live time for a specific demand
function DemandLiveTime({
  totalSeconds,
  hasActive,
  activeEntry,
}: {
  totalSeconds: number;
  hasActive: boolean;
  activeEntry?: BoardTimeEntry;
}) {
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

export function UserDetailTimeRow({ userData, isExpanded, onToggle }: UserDetailTimeRowProps) {
  const navigate = useNavigate();

  // Use live timer for user total time
  const liveTime = useLiveTimer({
    isActive: userData.isActive,
    baseSeconds: userData.totalSeconds,
    lastStartedAt: userData.activeStartedAt,
  });

  const initials = userData.profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Group entries by demand with active entry tracking
  const demandGroups = (() => {
    const demandMap = new Map<string, { 
      demand: BoardTimeEntry["demand"]; 
      totalSeconds: number; 
      hasActive: boolean;
      activeEntry?: BoardTimeEntry;
    }>();
    
    userData.entries.forEach(entry => {
      const d = demandMap.get(entry.demand_id) || { 
        demand: entry.demand, 
        totalSeconds: 0, 
        hasActive: false,
        activeEntry: undefined,
      };
      d.totalSeconds += entry.duration_seconds || 0;
      if (!entry.ended_at) {
        d.hasActive = true;
        d.activeEntry = entry;
      }
      demandMap.set(entry.demand_id, d);
    });
    
    return Array.from(demandMap.values());
  })();

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-3 text-left flex-1 min-w-0">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userData.profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {userData.isActive && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${userData.userId}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        navigate(`/user/${userData.userId}`);
                      }
                    }}
                    className="font-medium truncate hover:text-primary hover:underline cursor-pointer transition-colors"
                  >
                    {userData.profile.full_name}
                  </span>
                  {userData.isActive && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] h-5">
                      <Play className="h-2.5 w-2.5 mr-0.5 fill-current" />
                      Timer Ativo
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <span>{userData.demandCount} demanda{userData.demandCount !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>{userData.entries.length} entrada{userData.entries.length !== 1 ? 's' : ''}</span>
                  {userData.deliveredCount !== undefined && userData.deliveredCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {userData.deliveredCount} entregue{userData.deliveredCount !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {userData.inProgressCount !== undefined && userData.inProgressCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-3 w-3" />
                        {userData.inProgressCount} em andamento
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-mono font-bold",
                userData.isActive && "text-emerald-600 dark:text-emerald-400"
              )}>
                {liveTime || formatTimeDisplay(userData.totalSeconds) || "00:00:00:00"}
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
                  <TableHead>Demanda</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demandGroups.map(({ demand, totalSeconds, hasActive, activeEntry }) => (
                  <TableRow key={demand.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium" title={demand.title}>
                          {truncateText(demand.title)}
                        </span>
                        {hasActive && (
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: demand.status?.color,
                          color: demand.status?.color,
                        }}
                      >
                        {demand.status?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {demand.priority && (
                        <Badge className={priorityColors[demand.priority.toLowerCase()] || "bg-muted"}>
                          {demand.priority}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DemandLiveTime
                        totalSeconds={totalSeconds}
                        hasActive={hasActive}
                        activeEntry={activeEntry}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/demands/${demand.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
