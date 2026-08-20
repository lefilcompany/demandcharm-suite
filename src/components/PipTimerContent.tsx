import { Clock, Play, Pause, Loader2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { useUserTimerControl } from "@/hooks/useUserTimeTracking";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDemandCode } from "@/lib/demandCodeUtils";

interface PipTimerContentProps {
  demandId: string;
  onOpenDemand: () => void;
  onClose: () => void;
}

export function PipTimerContent({ demandId, onOpenDemand, onClose }: PipTimerContentProps) {
  const { isTimerRunning, totalSeconds, activeStartedAt, startTimer, stopTimer, isLoading } =
    useUserTimerControl(demandId);

  const { data: demand } = useQuery({
    queryKey: ["pip-demand", demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("id, title, board_sequence_number")
        .eq("id", demandId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!demandId,
  });

  const liveTime = useLiveTimer({
    isActive: isTimerRunning,
    baseSeconds: totalSeconds,
    lastStartedAt: activeStartedAt,
  });

  const displayTime = liveTime || formatTimeDisplay(totalSeconds) || "00:00:00";

  return (
    <div
      className="flex h-full w-full cursor-pointer flex-col justify-between gap-2 bg-background p-3 text-foreground"
      onClick={onOpenDemand}
      title="Voltar ao SoMA+"
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {demand?.board_sequence_number ? `${formatDemandCode(demand.board_sequence_number)} ` : ""}
          {demand?.title || "Demanda"}
        </p>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Fechar janela"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-emerald-600 dark:text-emerald-400">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="flex-1 font-mono text-base font-semibold tabular-nums">{displayTime}</span>
        {isTimerRunning && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            isTimerRunning
              ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30"
              : "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isLoading) return;
            if (isTimerRunning) stopTimer();
            else startTimer();
          }}
          disabled={isLoading}
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
        </button>
      </div>
    </div>
  );
}
