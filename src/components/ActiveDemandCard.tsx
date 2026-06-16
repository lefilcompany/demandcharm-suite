import { Link } from "react-router-dom";
import { Pause, ExternalLink, Clock, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { BoardTimeEntry } from "@/hooks/useBoardTimeEntries";
import { cn } from "@/lib/utils";

interface ActiveDemandCardProps {
  entry: BoardTimeEntry;
  demandTotalSeconds: number;
}

export function ActiveDemandCard({ entry, demandTotalSeconds }: ActiveDemandCardProps) {
  // Timer ao vivo
  const liveTime = useLiveTimer({
    isActive: true,
    baseSeconds: demandTotalSeconds,
    lastStartedAt: entry.started_at,
  });

  const initials = entry.profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const statusColor = entry.demand.status?.color || "#10b981";

  return (
    <Card className="relative overflow-hidden border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-50 via-transparent to-emerald-50/30 dark:from-emerald-950/40 dark:via-transparent dark:to-emerald-950/20 shadow-lg shadow-emerald-100/50 dark:shadow-emerald-900/20 group hover:shadow-xl hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30 transition-all duration-300">
      {/* Pulsing border effect */}
      <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-lg animate-pulse pointer-events-none" />
      
      {/* Glow effect */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-400/20 rounded-full blur-2xl" />
      
      <CardContent className="p-4 relative">
        <div className="flex items-start gap-4">
          {/* User Avatar with pulsing indicator */}
          <div className="relative shrink-0">
            <Avatar className="h-14 w-14 ring-2 ring-emerald-500 ring-offset-2 ring-offset-background shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30">
              <AvatarImage src={entry.profile.avatar_url || undefined} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Active indicator */}
            <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-3 border-background rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Pause className="h-3 w-3 fill-white text-white" />
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* User name */}
            <Link 
              to={`/user/${entry.user_id}`}
              className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline text-base"
            >
              {entry.profile.full_name}
            </Link>
            
            {/* Demand title */}
            <Link 
              to={`/demands/${entry.demand.id}`}
              className="block text-sm text-foreground/80 hover:text-foreground truncate mt-0.5 group-hover:text-primary transition-colors"
              title={entry.demand.title}
            >
              {entry.demand.title}
            </Link>

            {/* Status badge */}
            <div className="flex items-center gap-2 mt-2">
              <Badge 
                variant="outline"
                className="text-xs font-medium px-2 py-0.5 border-0 shadow-sm"
                style={{ 
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                }}
              >
                <span 
                  className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse"
                  style={{ backgroundColor: statusColor }}
                />
                {entry.demand.status?.name || "Em andamento"}
              </Badge>
              
              {entry.demand.priority && (
                <Badge variant="outline" className={cn(
                  "text-xs px-2 py-0.5",
                  entry.demand.priority === "alta" && "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
                  entry.demand.priority === "média" && "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
                  entry.demand.priority === "baixa" && "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                )}>
                  {entry.demand.priority}
                </Badge>
              )}
            </div>
          </div>

          {/* Timer */}
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
              <Zap className="h-4 w-4 animate-pulse" />
              <span className="text-xs font-medium uppercase tracking-wider">Ao vivo</span>
            </div>
            <div className="font-mono font-bold text-2xl text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
              {liveTime || formatTimeDisplay(demandTotalSeconds) || "00:00:00:00"}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 text-xs h-7 px-2 text-muted-foreground hover:text-primary"
              asChild
            >
              <Link to={`/demands/${entry.demand.id}`}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
