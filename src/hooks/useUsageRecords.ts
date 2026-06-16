import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedTeam } from "@/contexts/TeamContext";

export interface UsageRecord {
  id: string;
  team_id: string;
  period_start: string;
  period_end: string;
  demands_created: number;
  members_count: number;
  boards_count: number;
  notes_count: number;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
}

export function useUsageHistory(teamId?: string, limit = 12) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["usage-history", id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_records")
        .select("*")
        .eq("team_id", id!)
        .order("period_start", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as UsageRecord[];
    },
    enabled: !!id,
  });
}

export function useUsageForPeriod(teamId?: string, periodStart?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["usage-period", id, periodStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usage_records")
        .select("*")
        .eq("team_id", id!)
        .eq("period_start", periodStart!)
        .maybeSingle();

      if (error) throw error;
      return data as UsageRecord | null;
    },
    enabled: !!id && !!periodStart,
  });
}
