import { Clock, Play, Pause, Loader2, X, Maximize2 } from "lucide-react";
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

  const code = demand?.board_sequence_number
    ? formatDemandCode(demand.board_sequence_number)
    : "";

  return (
    <div
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 p-4 text-foreground shadow-lg transition-colors"
      onClick={onOpenDemand}
      title="Voltar ao SoMA+"
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-colors",
          isTimerRunning
            ? "bg-gradient-to-r from-primary to-amber-500"
            : "bg-gradient-to-r from-primary/60 to-primary/20"
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {code && (
            <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              {code}
            </span>
          )}
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">
            {demand?.title || "Demanda"}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Fechar janela"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Timer block */}
      <div className="mt-3 flex flex-1 flex-col justify-center">
        <div className="flex items-center justify-center gap-2.5">
          <Clock
            className={cn(
              "h-5 w-5 shrink-0 transition-colors",
              isTimerRunning ? "text-emerald-500" : "text-muted-foreground"
            )}
          />
          <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {displayTime}
          </span>
          {isTimerRunning && (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          )}
        </div>
        <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {isTimerRunning ? "Em execução" : "Pausado"}
        </p>
      </div>

      {/* Footer actions */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDemand();
          }}
          title="Abrir no SoMA+"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Abrir</span>
        </button>

        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
            isTimerRunning
              ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 dark:text-amber-400"
              : "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 dark:text-emerald-400"
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
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isTimerRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>Iniciar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
