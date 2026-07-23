import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTimerControl() {
  const queryClient = useQueryClient();

  const startTimer = useMutation({
    mutationFn: async (demandId: string) => {
      // Allow multiple concurrent timers across boards. We only ensure the
      // requested demand exists and isn't already running — no auto-pause of others.
      const { data: current, error: fetchError } = await supabase
        .from("demands")
        .select("id, last_started_at")
        .eq("id", demandId)
        .single();

      if (fetchError) throw fetchError;
      if (!current) throw new Error("Demanda não encontrada");

      // If already running, no-op (avoids resetting last_started_at and losing elapsed time).
      if (current.last_started_at) {
        return { alreadyRunning: true };
      }

      const { error } = await supabase
        .from("demands")
        .update({ last_started_at: new Date().toISOString() })
        .eq("id", demandId);

      if (error) throw error;

      return { alreadyRunning: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
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
