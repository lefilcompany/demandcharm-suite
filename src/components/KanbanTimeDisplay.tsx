import { Clock, Play, Pause, Loader2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { useUserTimerControl, useDemandUserTimeStats } from "@/hooks/useUserTimeTracking";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface KanbanTimeDisplayProps {
  demandId: string;
  canControl?: boolean;
  forceShow?: boolean;
  hideIfHasSubdemands?: boolean;
}

export function KanbanTimeDisplay({ demandId, canControl = false, forceShow = false, hideIfHasSubdemands = false }: KanbanTimeDisplayProps) {
  const { data: userStats } = useDemandUserTimeStats(demandId);
  const {
    isTimerRunning,
    totalSeconds,
    activeStartedAt,
    startTimer,
    stopTimer,
    isLoading,
  } = useUserTimerControl(demandId);

  const { data: hasSubdemands = false } = useQuery({
    queryKey: ["demand-has-subdemands", demandId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("demands")
        .select("id", { count: "exact", head: true })
        .eq("parent_demand_id", demandId)
        .eq("archived", false);

      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: hideIfHasSubdemands && !!demandId,
  });

  // Current user's live time
  const currentUserLiveTime = useLiveTimer({
    isActive: isTimerRunning,
    baseSeconds: totalSeconds,
    lastStartedAt: activeStartedAt,
  });

  const activeUsersCount = userStats?.filter(u => u.isActive).length || 0;
  const displayTime = currentUserLiveTime || formatTimeDisplay(totalSeconds) || "00:00:00:00";

  if (hideIfHasSubdemands && hasSubdemands) {
    return null;
  }

  // Don't show if no time tracked (unless forceShow is true)
  if (!forceShow && totalSeconds === 0 && !isTimerRunning && activeUsersCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-2 py-1 mb-2 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="font-mono font-semibold tabular-nums text-[11px] leading-tight whitespace-nowrap">
          {displayTime}
        </span>
        {isTimerRunning && (
          <span className="relative flex h-2 w-2 shrink-0" title="Timer em execução">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
        {activeUsersCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5 text-emerald-600 shrink-0">
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
      {canControl && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 shrink-0 text-[11px] font-medium gap-1 ml-auto",
            isTimerRunning 
              ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 hover:text-amber-700" 
              : "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 hover:text-emerald-700"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isLoading) return;
            if (isTimerRunning) {
              stopTimer();
            } else {
              startTimer();
            }
          }}
          disabled={isLoading}
          title={isTimerRunning ? "Pausar timer" : "Iniciar timer"}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isTimerRunning ? (
            <>
              <Pause className="h-3 w-3" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              <span>Iniciar</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
