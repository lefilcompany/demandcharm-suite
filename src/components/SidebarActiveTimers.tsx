import { Pause, Timer } from "lucide-react";
import { useActiveTimerDemands } from "@/hooks/useActiveTimerDemands";
import { NavLink } from "@/components/NavLink";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveTimer } from "@/hooks/useLiveTimer";
import { useStopUserTimer } from "@/hooks/useUserTimeTracking";
import { Button } from "@/components/ui/button";

interface ActiveTimerItemProps {
  demand: {
    id: string;
    title: string;
    started_at: string;
    total_seconds: number;
    boards: { name: string } | null;
  };
  isCollapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
}

function ActiveTimerItem({ demand, isCollapsed, isMobile, onClose }: ActiveTimerItemProps) {
  const formattedTime = useLiveTimer({
    isActive: true,
    baseSeconds: demand.total_seconds,
    lastStartedAt: demand.started_at,
  });
  const stopTimer = useStopUserTimer();

  const handlePause = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopTimer.mutate(demand.id);
  };

  const showText = isMobile || !isCollapsed;

  if (isCollapsed && !isMobile) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePause}
            disabled={stopTimer.isPending}
            className="h-10 w-10 hover:bg-destructive/20"
          >
            <Pause className="h-4 w-4 text-destructive" />
          </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-48">
          <p className="font-medium truncate">{demand.title}</p>
          <p className="text-xs text-primary font-mono">{formattedTime}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20">
      <NavLink
        to={`/demands/${demand.id}`}
        onClick={onClose}
        className="flex items-center gap-2 flex-1 min-w-0"
      >
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/20 shrink-0">
          <Timer className="h-3 w-3 text-primary" />
        </div>
        {showText && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{demand.title}</p>
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3 text-primary" />
              <span className="text-xs font-mono text-primary">{formattedTime}</span>
            </div>
          </div>
        )}
      </NavLink>
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePause}
        disabled={stopTimer.isPending}
        className="h-7 w-7 shrink-0 hover:bg-destructive/20"
      >
        <Pause className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

export function SidebarActiveTimers() {
  const { data: activeDemands, isLoading } = useActiveTimerDemands();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (isLoading || !activeDemands || activeDemands.length === 0) {
    return null;
  }

  const showText = isMobile || !isCollapsed;

  return (
    <div className={cn(
      "flex flex-col gap-1",
      isCollapsed && !isMobile ? "items-center" : ""
    )}>
      {showText && (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            Timers Ativos ({activeDemands.length})
          </span>
        </div>
      )}
      <div className={cn(
        "flex flex-col gap-1",
        isCollapsed && !isMobile ? "items-center" : ""
      )}>
        {activeDemands.slice(0, 3).map((demand) => (
          <ActiveTimerItem
            key={demand.id}
            demand={demand}
            isCollapsed={isCollapsed}
            isMobile={isMobile}
            onClose={closeMobileSidebar}
          />
        ))}
        {activeDemands.length > 3 && showText && (
          <span className="text-xs text-muted-foreground px-2">
            +{activeDemands.length - 3} mais
          </span>
        )}
      </div>
    </div>
  );
}
