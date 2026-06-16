import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, Trophy, Medal, Award, Clock, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { BoardUserTimeStats } from "@/hooks/useBoardTimeEntries";
import { cn } from "@/lib/utils";

interface LiveUserTimeRowProps {
  stats: BoardUserTimeStats;
  rank: number;
  maxTime?: number;
}

export function LiveUserTimeRow({ stats, rank, maxTime }: LiveUserTimeRowProps) {
  // Use live timer for active users
  const liveTime = useLiveTimer({
    isActive: stats.isActive,
    baseSeconds: stats.totalSeconds,
    lastStartedAt: stats.activeStartedAt,
  });

  const initials = stats.profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Calculate progress percentage
  const progressPercent = maxTime ? Math.min((stats.totalSeconds / maxTime) * 100, 100) : 0;

  // Rank badge/medal styling
  const getRankElement = () => {
    if (rank === 1) {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 text-white shadow-lg shadow-amber-300/40 dark:shadow-amber-900/40">
          <Trophy className="h-6 w-6 drop-shadow-sm" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500 text-white shadow-lg shadow-slate-300/30">
          <Medal className="h-6 w-6 drop-shadow-sm" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg shadow-orange-300/30">
          <Award className="h-6 w-6 drop-shadow-sm" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground font-bold text-xl border-2 border-border">
        {rank}
      </div>
    );
  };

  // Get rank-based colors for progress bar
  const getProgressColor = () => {
    if (stats.isActive) return "bg-emerald-500";
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-amber-500";
    if (rank === 2) return "bg-gradient-to-r from-slate-300 to-slate-400";
    if (rank === 3) return "bg-gradient-to-r from-amber-600 to-orange-600";
    return "bg-primary";
  };

  return (
    <div className={cn(
      "flex flex-col gap-3 p-4 rounded-xl transition-all",
      rank === 1 && "bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/20 border-2 border-amber-200 dark:border-amber-800/50 shadow-md shadow-amber-100 dark:shadow-amber-900/20",
      rank === 2 && "bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/20 border border-slate-200 dark:border-slate-700",
      rank === 3 && "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/40",
      rank > 3 && "hover:bg-muted/50 border border-border/50"
    )}>
      <div className="flex items-center gap-4">
        {getRankElement()}
        
        <Link to={`/user/${stats.userId}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <Avatar className={cn(
              "h-12 w-12 ring-2 ring-offset-2 ring-offset-background transition-all",
              stats.isActive ? "ring-emerald-500 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30" : "ring-transparent"
            )}>
              <AvatarImage src={stats.profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {stats.isActive && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 border-2 border-background rounded-full flex items-center justify-center shadow-lg shadow-emerald-300/50">
                <Play className="h-2.5 w-2.5 fill-white text-white" />
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-semibold truncate text-base",
                rank === 1 && "text-amber-700 dark:text-amber-400"
              )}>
                {stats.profile.full_name}
              </span>
              {rank === 1 && (
                <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 text-[10px] h-5 px-2 shadow-sm">
                  <Zap className="h-3 w-3 mr-0.5" />
                  TOP
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {stats.demandCount} demanda{stats.demandCount !== 1 ? 's' : ''}
              </span>
              {stats.deliveredCount !== undefined && stats.deliveredCount > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {stats.deliveredCount} entregue{stats.deliveredCount !== 1 ? 's' : ''}
                </span>
              )}
              {stats.inProgressCount !== undefined && stats.inProgressCount > 0 && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-3 w-3" />
                  {stats.inProgressCount} em andamento
                </span>
              )}
              {stats.isActive && (
                <Badge 
                  variant="secondary" 
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 gap-1 h-5 text-[10px] px-2"
                >
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Trabalhando agora
                </Badge>
              )}
            </div>
          </div>
        </Link>

        <div className={cn(
          "font-mono font-bold text-2xl tabular-nums text-right shrink-0 min-w-[140px]",
          stats.isActive && "text-emerald-600 dark:text-emerald-400",
          rank === 1 && !stats.isActive && "text-amber-700 dark:text-amber-400",
          rank === 2 && !stats.isActive && "text-slate-600 dark:text-slate-400",
          rank === 3 && !stats.isActive && "text-orange-600 dark:text-orange-400"
        )}>
          {liveTime || formatTimeDisplay(stats.totalSeconds) || "00:00:00:00"}
        </div>
      </div>

      {/* Progress bar showing relative time */}
      {maxTime && maxTime > 0 && (
        <div className="ml-16">
          <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                getProgressColor()
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
