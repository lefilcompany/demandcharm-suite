import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DemandListItem {
  id: string;
  title: string;
  board_sequence_number: number;
}

export function useDemandsList(boardId: string | null) {
  return useQuery({
    queryKey: ["demands-list", boardId],
    queryFn: async () => {
      if (!boardId) return [];
      
      const { data, error } = await supabase
        .from("demands")
        .select("id, title, board_sequence_number")
        .eq("board_id", boardId)
        .eq("archived", false)
        .order("board_sequence_number", { ascending: true });
      
      if (error) throw error;
      return (data || []) as DemandListItem[];
    },
    enabled: !!boardId,
  });
}
