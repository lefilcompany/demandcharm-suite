import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface ActiveTimerDemand {
  id: string;
  title: string;
  board_id: string;
  boards: { name: string } | null;
  started_at: string;
  total_seconds: number;
}

export function useActiveTimerDemands() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["active-timer-demands", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get active time entries for the current user (ended_at is null)
      const { data: activeEntries, error: entriesError } = await supabase
        .from("demand_time_entries")
        .select("demand_id, started_at")
        .eq("user_id", user.id)
        .is("ended_at", null);

      if (entriesError) throw entriesError;
      if (!activeEntries || activeEntries.length === 0) return [];

      // Get demand details for the active entries
      const demandIds = activeEntries.map(e => e.demand_id);
      const { data: demands, error: demandsError } = await supabase
        .from("demands")
        .select(`
          id,
          title,
          board_id,
          boards(name)
        `)
        .in("id", demandIds)
        .eq("archived", false);

      if (demandsError) throw demandsError;

      // Get all time entries for these demands to calculate total time
      const { data: allEntries } = await supabase
        .from("demand_time_entries")
        .select("demand_id, duration_seconds")
        .in("demand_id", demandIds)
        .eq("user_id", user.id);

      // Calculate total time per demand
      const totalTimeMap = new Map<string, number>();
      for (const entry of allEntries || []) {
        const current = totalTimeMap.get(entry.demand_id) || 0;
        totalTimeMap.set(entry.demand_id, current + (entry.duration_seconds || 0));
      }

      // Map active entries to started_at
      const startedAtMap = new Map(activeEntries.map(e => [e.demand_id, e.started_at]));

      // Combine data
      const result: ActiveTimerDemand[] = (demands || []).map(demand => ({
        id: demand.id,
        title: demand.title,
        board_id: demand.board_id,
        boards: demand.boards,
        started_at: startedAtMap.get(demand.id) || new Date().toISOString(),
        total_seconds: totalTimeMap.get(demand.id) || 0,
      }));

      // Sort by started_at descending
      result.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      return result;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
