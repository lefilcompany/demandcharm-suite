import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ParentSyncedTime {
  hasSubdemands: boolean;
  /** Closed time entries (seconds) of the parent demand + all its subdemands */
  totalSeconds: number;
  /** True when any timer (own or from a subdemand) is currently running */
  isActive: boolean;
  /** Earliest started_at among active timers (used to drive the live tick) */
  activeStartedAt: string | null;
  /** started_at of every active timer (own + subdemands) */
  activeStarts: string[];
  activeCount: number;
}

const EMPTY: ParentSyncedTime = {
  hasSubdemands: false,
  totalSeconds: 0,
  isActive: false,
  activeStartedAt: null,
  activeStarts: [],
  activeCount: 0,
};

/**
 * Synchronized time for a parent demand: its own time entries plus the time
 * entries of all its (non-archived) subdemands. When a subdemand timer runs,
 * the parent counter runs too.
 */
export function useParentSyncedTime(demandId: string | undefined) {
  return useQuery({
    queryKey: ["parent-synced-time", demandId],
    queryFn: async (): Promise<ParentSyncedTime> => {
      if (!demandId) return EMPTY;

      const { data: subs, error: subsError } = await supabase
        .from("demands")
        .select("id")
        .eq("parent_demand_id", demandId)
        .eq("archived", false);

      if (subsError) throw subsError;

      const subIds = (subs || []).map((s) => s.id);
      if (subIds.length === 0) return EMPTY;

      const { data: entries, error } = await supabase
        .from("demand_time_entries")
        .select("demand_id, started_at, ended_at, duration_seconds")
        .in("demand_id", [demandId, ...subIds]);

      if (error) throw error;

      let totalSeconds = 0;
      const activeStarts: string[] = [];

      for (const entry of entries || []) {
        if (entry.ended_at) {
          totalSeconds += entry.duration_seconds || 0;
        } else {
          activeStarts.push(entry.started_at);
        }
      }

      activeStarts.sort();

      return {
        hasSubdemands: true,
        totalSeconds,
        isActive: activeStarts.length > 0,
        activeStartedAt: activeStarts[0] || null,
        activeStarts,
        activeCount: activeStarts.length,
      };
    },
    enabled: !!demandId,
    refetchInterval: 5000,
  });
}

/** Live elapsed seconds summed across all active timers (call every render tick). */
export function getSyncedElapsedSeconds(synced: ParentSyncedTime | undefined): number {
  if (!synced) return 0;
  return synced.activeStarts.reduce(
    (sum, startedAt) => sum + Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
    0
  );
}
