import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DueDateChange {
  id: string;
  demand_id: string;
  previous_due_date: string | null;
  new_due_date: string | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
  profile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

/** History of deadline changes for a demand (initial deadline stays frozen on demands.original_due_date). */
export function useDueDateHistory(demandId: string | null | undefined) {
  return useQuery({
    queryKey: ["due-date-history", demandId],
    queryFn: async (): Promise<DueDateChange[]> => {
      if (!demandId) return [];
      const { data, error } = await supabase
        .from("demand_due_date_changes")
        .select("*")
        .eq("demand_id", demandId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data || []) as unknown as DueDateChange[];
      const userIds = Array.from(new Set(rows.map((r) => r.changed_by).filter(Boolean))) as string[];
      if (userIds.length === 0) return rows;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: r.changed_by ? map.get(r.changed_by) ?? null : null }));
    },
    enabled: !!demandId,
    staleTime: 30000,
  });
}

/** Reschedule a demand deadline with a mandatory justification (logged automatically). */
export function useRescheduleDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demandId,
      newDueDate,
      reason,
    }: {
      demandId: string;
      newDueDate: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc("reschedule_demand", {
        p_demand_id: demandId,
        p_new_due_date: newDueDate,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["due-date-history", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["all-team-demands"] });
    },
  });
}
