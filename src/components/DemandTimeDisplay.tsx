import { Calendar, Clock, Play, Pause, Loader2 } from "lucide-react";
import { useLiveTimer, getTotalTimeSinceCreation, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DemandTimeDisplayProps {
  createdAt?: string;
  updatedAt?: string;
  timeInProgressSeconds?: number | null;
  lastStartedAt?: string | null;
  isInProgress?: boolean;
  isDelivered?: boolean;
  variant?: "card" | "detail" | "table";
  // Timer control props
  showTimerControls?: boolean;
  isTimerRunning?: boolean;
  onPlayClick?: () => void;
  onPauseClick?: () => void;
  isLoading?: boolean;
}

export function DemandTimeDisplay({
  createdAt,
  updatedAt,
  timeInProgressSeconds,
  lastStartedAt,
  isInProgress = false,
  isDelivered = false,
  variant = "card",
  showTimerControls = false,
  isTimerRunning = false,
  onPlayClick,
  onPauseClick,
  isLoading = false,
}: DemandTimeDisplayProps) {
  // Live timer for execution time when timer is running
  const liveExecutionTime = useLiveTimer({
    isActive: isTimerRunning,
    baseSeconds: timeInProgressSeconds || 0,
    lastStartedAt,
  });

  // Calculate total time (from creation to delivery or now)
  const totalTime = isDelivered
    ? getTotalTimeSinceCreation(createdAt, updatedAt)
    : getTotalTimeSinceCreation(createdAt);

  // For delivered demands, show static execution time
  const executionTime = isDelivered
    ? formatTimeDisplay(timeInProgressSeconds || 0)
    : liveExecutionTime;

  // Don't show anything if both are null/zero
  if (!totalTime && !executionTime) return null;

  // Timer control button component
  const TimerButton = () => {
    if (!showTimerControls) return null;
    
    return (
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
          if (isLoading) return;
          if (isTimerRunning) {
            onPauseClick?.();
          } else {
            onPlayClick?.();
          }
        }}
        disabled={isLoading}
        title={isTimerRunning ? "Pausar timer" : "Iniciar timer"}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isTimerRunning ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  };

  if (variant === "table") {
    return (
      <div className="flex flex-col gap-0.5 text-xs">
        {executionTime && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{executionTime}</span>
          </div>
        )}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="flex flex-wrap gap-3">
        {totalTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
            <Calendar className="h-4 w-4" />
            <span className="text-xs uppercase font-medium">Total:</span>
            <span className="font-mono font-medium">{totalTime}</span>
          </div>
        )}
        {executionTime && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-1.5">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase font-medium">Execução:</span>
            <span className="font-mono font-medium">{executionTime}</span>
            {isTimerRunning && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            <TimerButton />
          </div>
        )}
      </div>
    );
  }

  // Card variant (default)
  return (
    <div className="flex flex-col gap-1 mb-2">
      {totalTime && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
          <Calendar className="h-3 w-3" />
          <span className="text-[10px] uppercase font-medium">Total:</span>
          <span className="font-mono font-medium">{totalTime}</span>
        </div>
      )}
      {executionTime && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-2 py-1">
          <Clock className="h-3 w-3" />
          <span className="text-[10px] uppercase font-medium">Execução:</span>
          <span className="font-mono font-medium flex-1">{executionTime}</span>
          {isTimerRunning && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <TimerButton />
        </div>
      )}
    </div>
  );
}