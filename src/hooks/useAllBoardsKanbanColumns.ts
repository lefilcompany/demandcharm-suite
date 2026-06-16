import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { boardStatusToColumn, sortWithFixedBoundaries, type KanbanColumn, type BoardStatus, type AdjustmentType } from "@/hooks/useBoardStatuses";

/**
 * Fetches kanban columns merged from all boards the user is a member of in a team.
 * Deduplicates columns by status name, keeping the first occurrence's color/config.
 */
export function useAllBoardsKanbanColumns(teamId: string | null | undefined) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["all-boards-kanban-columns", teamId, user?.id],
    queryFn: async () => {
      if (!teamId || !user) return [];

      // Get boards the user is member of in this team
      const { data: userBoards, error: boardsError } = await supabase
        .from("board_members")
        .select("board_id, boards!inner(id, team_id)")
        .eq("user_id", user.id);

      if (boardsError) throw boardsError;

      const boardIds = (userBoards || [])
        .filter((b: any) => b.boards?.team_id === teamId)
        .map((b: any) => b.board_id);

      if (boardIds.length === 0) return [];

      // Fetch all active board statuses for these boards
      const { data: allStatuses, error } = await supabase
        .from("board_statuses")
        .select(`
          id,
          board_id,
          status_id,
          position,
          is_active,
          created_at,
          adjustment_type,
          visible_to_roles,
          status:demand_statuses(id, name, color, is_system)
        `)
        .in("board_id", boardIds)
        .eq("is_active", true)
        .order("position");

      if (error) throw error;

      const validStatuses = (allStatuses || [])
        .filter((d: any) => d.status !== null)
        .map((d: any) => ({
          ...d,
          adjustment_type: (d.adjustment_type as AdjustmentType) || "none",
          visible_to_roles: d.visible_to_roles || null,
        })) as BoardStatus[];

      // Sort with fixed boundaries
      const sorted = sortWithFixedBoundaries(validStatuses);

      // Deduplicate by status name, keeping first occurrence
      const seen = new Set<string>();
      const unique: BoardStatus[] = [];
      for (const bs of sorted) {
        if (!seen.has(bs.status.name)) {
          seen.add(bs.status.name);
          unique.push(bs);
        }
      }

      return unique.map(boardStatusToColumn);
    },
    enabled: !!teamId && !!user,
    staleTime: 30000,
  });

  return {
    columns: (data && data.length > 0 ? data : undefined) as KanbanColumn[] | undefined,
    isLoading,
  };
}
