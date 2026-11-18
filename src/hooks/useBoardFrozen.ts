import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** True when every project the board belongs to is inactive — the database then refuses new demands, requests, stage moves and timers. */
export function useBoardFrozen(boardId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["board-frozen", boardId],
    enabled: !!boardId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_board_frozen" as any, { _board_id: boardId });
      if (error) return false;
      return !!data;
    },
  });
  return !!data;
}
