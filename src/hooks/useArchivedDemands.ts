import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { sortDemandsByPriorityAndDueDate } from "./useDemands";

export function useArchivedDemands(boardId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["archived-demands", boardId],
    queryFn: async () => {
      let query = supabase
        .from("demands")
        .select(`
          *,
          demand_statuses(name, color),
          profiles!demands_created_by_fkey(full_name, avatar_url),
          assigned_profile:profiles!demands_assigned_to_fkey(full_name, avatar_url),
          teams(name)
        `)
        .eq("archived", true);

      if (boardId) {
        query = query.eq("board_id", boardId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Sort by priority then due date
      return sortDemandsByPriorityAndDueDate(data || []);
    },
    enabled: !!user && !!boardId,
  });
}
