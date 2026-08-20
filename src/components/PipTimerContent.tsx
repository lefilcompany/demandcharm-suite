import { Play, Pause, Loader2, X, ArrowUpRight } from "lucide-react";
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
      className="relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl bg-card text-card-foreground select-none"
      onClick={onOpenDemand}
      title="Voltar ao SoMA+"
    >
      {/* Warm radial glow — the signature. Breathes when the timer is alive. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          isTimerRunning ? "opacity-100 animate-pulse" : "opacity-30"
        )}
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, hsl(var(--primary) / 0.22) 0%, hsl(var(--primary) / 0.06) 35%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5"
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {code && (
            <span className="shrink-0 rounded bg-primary px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
              {code}
            </span>
          )}
          <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-foreground">
            {demand?.title || "Demanda"}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Fechar janela"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Hero timer */}
      <div className="relative z-10 flex flex-1 items-center justify-center gap-2 px-3">
        {isTimerRunning && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
        )}
        <span className="font-mono text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
          {displayTime}
        </span>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center gap-1.5 px-3 pb-2.5">
        <button
          type="button"
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDemand();
          }}
          title="Abrir no SoMA+"
        >
          <ArrowUpRight className="h-3 w-3" />
          <span>Abrir</span>
        </button>

        <button
          type="button"
          className={cn(
            "ml-auto flex items-center justify-center gap-1 rounded-md px-3 py-1 text-[11px] font-semibold transition-all duration-200",
            isTimerRunning
              ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/25"
              : "bg-primary text-primary-foreground shadow-[0_3px_10px_-3px_hsl(var(--primary)/0.6)] hover:brightness-110"
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
              <Pause className="h-3 w-3 fill-current" />
              <span>Pausar</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              <span>Iniciar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
