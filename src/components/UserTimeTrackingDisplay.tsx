import { useNavigate } from "react-router-dom";
import { Clock, Play, Pause, Loader2, Users } from "lucide-react";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { useDemandTimeEntries, useDemandUserTimeStats, useUserTimerControl } from "@/hooks/useUserTimeTracking";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TimeEntryEditDialog } from "./TimeEntryEditDialog";
import { useAuth } from "@/lib/auth";
interface UserTimeTrackingDisplayProps {
  demandId: string;
  variant?: "card" | "detail";
  showControls?: boolean;
  canControl?: boolean;
  canEdit?: boolean;
}

// Individual user time row with live timer
function UserTimeRow({ 
  userId,
  profile, 
  totalSeconds, 
  isActive, 
  activeStartedAt,
  isCurrentUser,
}: {
  userId: string;
  profile: { full_name: string; avatar_url: string | null };
  totalSeconds: number;
  isActive: boolean;
  activeStartedAt: string | null;
  isCurrentUser?: boolean;
}) {
  const navigate = useNavigate();
  const liveTime = useLiveTimer({
    isActive,
    baseSeconds: totalSeconds,
    lastStartedAt: activeStartedAt,
  });

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn(
      "flex items-center gap-2 py-1",
      isCurrentUser && "bg-primary/5 rounded px-2 -mx-2"
    )}>
      <Avatar 
        className="h-5 w-5 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
        onClick={() => navigate(`/user/${userId}`)}
      >
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={() => navigate(`/user/${userId}`)}
        className="text-xs text-muted-foreground flex-1 truncate text-left hover:text-primary hover:underline cursor-pointer transition-colors"
      >
        {profile.full_name}
        {isCurrentUser && <span className="text-primary ml-1">(você)</span>}
      </button>
      <div className="flex items-center gap-1">
        {isActive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
        <span className={cn(
          "font-mono text-xs",
          isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        )}>
          {liveTime || "00:00:00:00"}
        </span>
      </div>
    </div>
  );
}

export function UserTimeTrackingDisplay({
  demandId,
  variant = "detail",
  showControls = true,
  canControl = true,
  canEdit = true,
}: UserTimeTrackingDisplayProps) {
  const { user } = useAuth();
  const { data: userStats, isLoading: isLoadingStats } = useDemandUserTimeStats(demandId);
  const { data: allEntries, isLoading: isLoadingEntries } = useDemandTimeEntries(demandId);
  const {
    isTimerRunning,
    totalSeconds,
    activeStartedAt,
    startTimer,
    stopTimer,
    isLoading: isTimerLoading,
  } = useUserTimerControl(demandId);

  // Filter entries for current user only
  const currentUserEntries = allEntries?.filter((e) => e.user_id === user?.id) || [];

  // Current user's live time
  const currentUserLiveTime = useLiveTimer({
    isActive: isTimerRunning,
    baseSeconds: totalSeconds,
    lastStartedAt: activeStartedAt,
  });

  // Calculate total time from all users
  const grandTotalSeconds = userStats?.reduce((sum, user) => {
    let userTotal = user.totalSeconds;
    // Add live elapsed time for active users
    if (user.isActive && user.activeStartedAt) {
      const elapsed = Math.floor((Date.now() - new Date(user.activeStartedAt).getTime()) / 1000);
      userTotal += elapsed;
    }
    return sum + userTotal;
  }, 0) || 0;

  const activeUsersCount = userStats?.filter(u => u.isActive).length || 0;

  if (variant === "card") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-2 py-1">
        <Clock className="h-3 w-3" />
        <span className="text-[10px] uppercase font-medium">Execução:</span>
        <span className="font-mono font-medium flex-1">
          {currentUserLiveTime || formatTimeDisplay(totalSeconds) || "00:00:00:00"}
        </span>
        {isTimerRunning && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
        {showControls && canControl && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0",
              isTimerRunning 
                ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 hover:text-amber-700" 
                : "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 hover:text-emerald-700"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isTimerLoading) return;
              if (isTimerRunning) {
                stopTimer();
              } else {
                startTimer();
              }
            }}
            disabled={isTimerLoading}
            title={isTimerRunning ? "Pausar meu timer" : "Iniciar meu timer"}
          >
            {isTimerLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isTimerRunning ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        {activeUsersCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5 text-emerald-600">
                  <Users className="h-3 w-3" />
                  <span className="text-[10px]">{activeUsersCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{activeUsersCount} {activeUsersCount === 1 ? "pessoa" : "pessoas"} trabalhando</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Detail variant - show full breakdown
  return (
    <div className="space-y-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 md:p-4">
      {/* Summary header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/15 shrink-0">
          <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Tempo de Execução</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {currentUserLiveTime || formatTimeDisplay(totalSeconds) || "00:00:00:00"}
            </span>
            {isTimerRunning && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {demandId && canEdit && (
            <TimeEntryEditDialog
              entries={currentUserEntries}
              demandId={demandId}
              isLoading={isLoadingEntries}
            />
          )}
          {showControls && canControl && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full shrink-0",
                isTimerRunning 
                  ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 hover:text-amber-700" 
                  : "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 hover:text-emerald-700"
              )}
              onClick={() => {
                if (isTimerLoading) return;
                if (isTimerRunning) {
                  stopTimer();
                } else {
                  startTimer();
                }
              }}
              disabled={isTimerLoading}
              title={isTimerRunning ? "Pausar meu timer" : "Iniciar meu timer"}
            >
              {isTimerLoading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : isTimerRunning ? (
                <Pause className="h-4.5 w-4.5" />
              ) : (
                <Play className="h-4.5 w-4.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Team breakdown */}
      {userStats && userStats.length > 0 && (
        <div className="bg-muted/50 rounded-md px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Tempo por pessoa
            </span>
            {activeUsersCount > 0 && (
              <span className="text-xs text-emerald-600 ml-auto">
                {activeUsersCount} ativo{activeUsersCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {userStats.map((userStat) => (
              <UserTimeRow
                key={userStat.userId}
                userId={userStat.userId}
                profile={userStat.profile}
                totalSeconds={userStat.totalSeconds}
                isActive={userStat.isActive}
                activeStartedAt={userStat.activeStartedAt}
              />
            ))}
          </div>
          <div className="border-t border-border mt-2 pt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total da equipe:</span>
            <span className="font-mono font-medium text-foreground">
              {formatTimeDisplay(grandTotalSeconds) || "00:00:00:00"}
            </span>
          </div>
        </div>
      )}

      {isLoadingStats && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
