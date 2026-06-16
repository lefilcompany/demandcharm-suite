import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTimerControl() {
  const queryClient = useQueryClient();

  const startTimer = useMutation({
    mutationFn: async (demandId: string) => {
      // First, get the team_id of the demand we want to start
      const { data: targetDemand, error: targetError } = await supabase
        .from("demands")
        .select("team_id")
        .eq("id", demandId)
        .single();

      if (targetError) throw targetError;
      if (!targetDemand?.team_id) throw new Error("Demanda não encontrada");

      // Find any demand with an active timer in the same team (excluding the one we want to start)
      const { data: runningDemands, error: fetchError } = await supabase
        .from("demands")
        .select("id, last_started_at, time_in_progress_seconds, title")
        .eq("team_id", targetDemand.team_id)
        .not("last_started_at", "is", null)
        .neq("id", demandId);

      if (fetchError) throw fetchError;

      // Pause any running timers first
      if (runningDemands && runningDemands.length > 0) {
        for (const running of runningDemands) {
          if (running.last_started_at) {
            const elapsedMs = Date.now() - new Date(running.last_started_at).getTime();
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const newTotalSeconds = (running.time_in_progress_seconds || 0) + elapsedSeconds;

            const { error: pauseError } = await supabase
              .from("demands")
              .update({
                last_started_at: null,
                time_in_progress_seconds: newTotalSeconds,
              })
              .eq("id", running.id);

            if (pauseError) throw pauseError;
          }
        }
      }

      // Now start the timer for the requested demand
      const { error } = await supabase
        .from("demands")
        .update({ last_started_at: new Date().toISOString() })
        .eq("id", demandId);

      if (error) throw error;

      return { pausedCount: runningDemands?.length || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      if (data.pausedCount > 0) {
        toast.info("Timer anterior pausado automaticamente");
      }
    },
    onError: (error) => {
      console.error("Error starting timer:", error);
      toast.error("Erro ao iniciar o timer");
    },
  });

  const pauseTimer = useMutation({
    mutationFn: async ({ demandId, lastStartedAt, currentSeconds }: { 
      demandId: string; 
      lastStartedAt: string; 
      currentSeconds: number;
    }) => {
      // Calculate elapsed time since last_started_at
      const elapsedMs = Date.now() - new Date(lastStartedAt).getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const newTotalSeconds = currentSeconds + elapsedSeconds;

      const { error } = await supabase
        .from("demands")
        .update({ 
          last_started_at: null,
          time_in_progress_seconds: newTotalSeconds 
        })
        .eq("id", demandId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
    onError: (error) => {
      console.error("Error pausing timer:", error);
      toast.error("Erro ao pausar o timer");
    },
  });

  return {
    startTimer,
    pauseTimer,
    isLoading: startTimer.isPending || pauseTimer.isPending,
  };
}
