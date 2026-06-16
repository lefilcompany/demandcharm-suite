import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useTeamScope } from "./useTeamScope";

export function useBoardMonthlyDemandCount(boardId?: string) {
  const { selectedBoardId } = useSelectedBoardSafe();
  const id = boardId || selectedBoardId;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return useQuery({
    queryKey: ["board-monthly-demand-count", id, month, year],
    queryFn: async () => {
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

      const { count, error } = await supabase
        .from("demands")
        .select("*", { count: "exact", head: true })
        .eq("board_id", id!)
        .gte("created_at", startOfMonth)
        .lte("created_at", endOfMonth);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id,
  });
}

export function useBoardLimit(boardId?: string) {
  const { selectedBoardId } = useSelectedBoardSafe();
  const id = boardId || selectedBoardId;

  return useQuery({
    queryKey: ["board-limit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("monthly_demand_limit, team_id")
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCanCreateDemandOnBoard(boardId?: string, teamId?: string) {
  const { data: boardLimit } = useBoardLimit(boardId);
  const { data: monthlyCount } = useBoardMonthlyDemandCount(boardId);
  const { data: teamScope } = useTeamScope(teamId || boardLimit?.team_id);

  // Check if team is active
  const isTeamActive = teamScope?.active ?? true;

  // Check if board has reached its limit
  const limit = boardLimit?.monthly_demand_limit ?? 0;
  const hasBoardLimit = limit > 0;
  const isWithinLimit = !hasBoardLimit || (monthlyCount ?? 0) < limit;

  const canCreate = isTeamActive && isWithinLimit;

  return {
    canCreate,
    isTeamActive,
    isWithinLimit,
    hasBoardLimit,
    monthlyCount: monthlyCount ?? 0,
    limit,
    isLoading: boardLimit === undefined || monthlyCount === undefined || teamScope === undefined,
  };
}
