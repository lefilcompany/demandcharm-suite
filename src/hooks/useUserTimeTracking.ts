import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface TimeEntry {
  id: string;
  demand_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface UserTimeStats {
  userId: string;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
  totalSeconds: number;
  isActive: boolean;
  activeStartedAt: string | null;
}

// Fetch all time entries for a demand
export function useDemandTimeEntries(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-time-entries", demandId],
    queryFn: async () => {
      if (!demandId) return [];

      // Fetch time entries
      const { data: entries, error: entriesError } = await supabase
        .from("demand_time_entries")
        .select("*")
        .eq("demand_id", demandId)
        .order("created_at", { ascending: false });

      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) return [];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(entries.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Combine entries with profiles
      return entries.map(entry => ({
        ...entry,
        profile: profileMap.get(entry.user_id) || { full_name: "Usuário", avatar_url: null },
      })) as TimeEntry[];
    },
    enabled: !!demandId,
  });
}

// Get aggregated time stats per user for a demand
export function useDemandUserTimeStats(demandId: string | undefined) {
  const { data: entries, isLoading } = useDemandTimeEntries(demandId);

  const stats: UserTimeStats[] = [];
  
  if (entries) {
    const userMap = new Map<string, UserTimeStats>();

    for (const entry of entries) {
      const existing = userMap.get(entry.user_id);
      
      let entrySeconds = entry.duration_seconds || 0;
      // If entry is still active (no ended_at), calculate elapsed time
      const isActive = !entry.ended_at;
      
      if (existing) {
        existing.totalSeconds += entrySeconds;
        if (isActive) {
          existing.isActive = true;
          existing.activeStartedAt = entry.started_at;
        }
      } else {
        userMap.set(entry.user_id, {
          userId: entry.user_id,
          profile: entry.profile || { full_name: "Usuário", avatar_url: null },
          totalSeconds: entrySeconds,
          isActive,
          activeStartedAt: isActive ? entry.started_at : null,
        });
      }
    }

    stats.push(...userMap.values());
  }

  return { data: stats, isLoading };
}

// Check if current user has an active timer on a demand
export function useCurrentUserActiveTimer(demandId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-active-timer", demandId, user?.id],
    queryFn: async () => {
      if (!demandId || !user?.id) return null;

      const { data, error } = await supabase
        .from("demand_time_entries")
        .select("*")
        .eq("demand_id", demandId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle();

      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!demandId && !!user?.id,
  });
}

// Get current user's total time on a demand
export function useCurrentUserDemandTime(demandId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-demand-time", demandId, user?.id],
    queryFn: async () => {
      if (!demandId || !user?.id) return { totalSeconds: 0, activeEntry: null };

      const { data: entries, error } = await supabase
        .from("demand_time_entries")
        .select("*")
        .eq("demand_id", demandId)
        .eq("user_id", user.id);

      if (error) throw error;

      let totalSeconds = 0;
      let activeEntry: TimeEntry | null = null;

      for (const entry of entries || []) {
        totalSeconds += entry.duration_seconds || 0;
        if (!entry.ended_at) {
          activeEntry = entry as TimeEntry;
        }
      }

      return { totalSeconds, activeEntry };
    },
    enabled: !!demandId && !!user?.id,
  });
}

// Start timer for current user
export function useStartUserTimer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (demandId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Allow multiple concurrent timers: do NOT stop other active timers.
      // Only prevent starting a duplicate timer on the SAME demand.
      const { data: existing, error: existingError } = await supabase
        .from("demand_time_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("demand_id", demandId)
        .is("ended_at", null)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        return { entry: existing, stoppedCount: 0 };
      }

      // Start new timer for this demand
      const { data, error } = await supabase
        .from("demand_time_entries")
        .insert({
          demand_id: demandId,
          user_id: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { entry: data, stoppedCount: 0 };
    },

    onMutate: async (demandId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["user-demand-time", demandId, user?.id] });
      await queryClient.cancelQueries({ queryKey: ["active-timer-demands", user?.id] });
      
      // Snapshot current values
      const previousTime = queryClient.getQueryData(["user-demand-time", demandId, user?.id]);
      const previousActive = queryClient.getQueryData(["active-timer-demands", user?.id]);
      
      // Optimistically update to running state
      const now = new Date().toISOString();
      queryClient.setQueryData(["user-demand-time", demandId, user?.id], (old: any) => {
        return {
          totalSeconds: old?.totalSeconds || 0,
          activeEntry: {
            id: "temp-" + Date.now(),
            demand_id: demandId,
            user_id: user?.id,
            started_at: now,
            ended_at: null,
            duration_seconds: 0,
          },
        };
      });

      // Optimistically append to sidebar active timers (keep existing ones)
      queryClient.setQueryData(["active-timer-demands", user?.id], (old: any[]) => {
        const list = Array.isArray(old) ? old : [];
        if (list.some((t) => t.id === demandId)) return list;
        return [
          ...list,
          {
            id: demandId,
            title: "...",
            board_id: "",
            boards: null,
            started_at: now,
            total_seconds: 0,
          },
        ];
      });
      
      return { previousTime, previousActive };
    },
    onError: (error, demandId, context) => {
      // Rollback on error
      if (context?.previousTime) {
        queryClient.setQueryData(["user-demand-time", demandId, user?.id], context.previousTime);
      }
      if (context?.previousActive !== undefined) {
        queryClient.setQueryData(["active-timer-demands", user?.id], context.previousActive);
      }
      console.error("Error starting timer:", error);
      toast.error("Erro ao iniciar o timer");
    },
    onSuccess: () => {},

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["user-active-timer"] });
      queryClient.invalidateQueries({ queryKey: ["user-demand-time"] });
      queryClient.invalidateQueries({ queryKey: ["active-timer-demands"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-parent-time"] });
    },
  });
}

// Stop timer for current user
export function useStopUserTimer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (demandId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      // Find active timer for this user on this demand
      const { data: activeTimer, error: fetchError } = await supabase
        .from("demand_time_entries")
        .select("*")
        .eq("demand_id", demandId)
        .eq("user_id", user.id)
        .is("ended_at", null)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!activeTimer) throw new Error("Nenhum timer ativo encontrado");

      const elapsedMs = Date.now() - new Date(activeTimer.started_at).getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      const { error } = await supabase
        .from("demand_time_entries")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: elapsedSeconds,
        })
        .eq("id", activeTimer.id);

      if (error) throw error;
      return { elapsedSeconds };
    },
    onMutate: async (demandId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["user-demand-time", demandId, user?.id] });
      await queryClient.cancelQueries({ queryKey: ["user-active-timer", demandId, user?.id] });
      await queryClient.cancelQueries({ queryKey: ["active-timer-demands", user?.id] });
      
      // Snapshot current values
      const previousTime = queryClient.getQueryData(["user-demand-time", demandId, user?.id]);
      const previousActive = queryClient.getQueryData(["active-timer-demands", user?.id]);
      
      // Optimistically update to stopped state
      queryClient.setQueryData(["user-demand-time", demandId, user?.id], (old: any) => {
        if (!old) return old;
        const elapsed = old.activeEntry 
          ? Math.floor((Date.now() - new Date(old.activeEntry.started_at).getTime()) / 1000)
          : 0;
        return {
          totalSeconds: old.totalSeconds + elapsed,
          activeEntry: null,
        };
      });

      // Optimistically remove from sidebar
      queryClient.setQueryData(["active-timer-demands", user?.id], (old: any[]) => {
        if (!old) return [];
        return old.filter((d: any) => d.id !== demandId);
      });
      
      return { previousTime, previousActive };
    },
    onError: (error, demandId, context) => {
      // Rollback on error
      if (context?.previousTime) {
        queryClient.setQueryData(["user-demand-time", demandId, user?.id], context.previousTime);
      }
      if (context?.previousActive !== undefined) {
        queryClient.setQueryData(["active-timer-demands", user?.id], context.previousActive);
      }
      console.error("Error stopping timer:", error);
      toast.error("Erro ao pausar o timer");
    },
    onSettled: (_, __, demandId) => {
      queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["user-active-timer"] });
      queryClient.invalidateQueries({ queryKey: ["user-demand-time"] });
      queryClient.invalidateQueries({ queryKey: ["active-timer-demands"] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-parent-time"] });
    },
  });
}

// Hook combining start/stop for easier use
export function useUserTimerControl(demandId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: userTime, isLoading: isLoadingTime } = useCurrentUserDemandTime(demandId);
  const startTimer = useStartUserTimer();
  const stopTimer = useStopUserTimer();

  const channelInstanceId = useRef(createRealtimeInstanceId());

  // Subscribe to realtime updates for this demand's time entries
  useEffect(() => {
    if (!demandId) return;

    const channel = supabase
      .channel(`demand-time-entries-${demandId}-${channelInstanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demand_time_entries',
          filter: `demand_id=eq.${demandId}`,
        },
        () => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["demand-time-entries", demandId] });
          queryClient.invalidateQueries({ queryKey: ["user-active-timer", demandId] });
          queryClient.invalidateQueries({ queryKey: ["user-demand-time", demandId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demandId, queryClient]);

  const isTimerRunning = !!userTime?.activeEntry;
  const totalSeconds = userTime?.totalSeconds || 0;
  const activeStartedAt = userTime?.activeEntry?.started_at || null;

  return {
    isTimerRunning,
    totalSeconds,
    activeStartedAt,
    startTimer: () => demandId && startTimer.mutate(demandId),
    stopTimer: () => demandId && stopTimer.mutate(demandId),
    isLoading: startTimer.isPending || stopTimer.isPending || isLoadingTime,
  };
}
