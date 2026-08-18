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
        .select("*, profile:profiles!demand_due_date_changes_changed_by_fkey(id, full_name, avatar_url)")
        .eq("demand_id", demandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DueDateChange[];
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
