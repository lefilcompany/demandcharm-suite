import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  boardStatusToColumn,
  sortWithFixedBoundaries,
  type AdjustmentType,
  type BoardStatus,
  type KanbanColumn,
} from "@/hooks/useBoardStatuses";

/** Kanban columns for several boards at once, keyed by board id. */
export function useBoardsColumns(boardIds: string[]) {
  const ids = [...boardIds].filter(Boolean).sort();

  return useQuery({
    queryKey: ["boards-columns", ids.join(",")],
    queryFn: async () => {
      const result: Record<string, KanbanColumn[]> = {};
      if (ids.length === 0) return result;

      const { data, error } = await supabase
        .from("board_statuses")
        .select(
          `id, board_id, status_id, position, is_active, created_at, adjustment_type, visible_to_roles,
           status:demand_statuses(id, name, color, is_system)`
        )
        .in("board_id", ids)
        .eq("is_active", true)
        .order("position");

      if (error) throw error;

      const byBoard = new Map<string, BoardStatus[]>();
      (data || [])
        .filter((d: any) => d.status !== null)
        .forEach((d: any) => {
          const row = {
            ...d,
            adjustment_type: (d.adjustment_type as AdjustmentType) || "none",
            visible_to_roles: d.visible_to_roles || null,
          } as BoardStatus;
          const list = byBoard.get(d.board_id) || [];
          list.push(row);
          byBoard.set(d.board_id, list);
        });

      byBoard.forEach((statuses, boardId) => {
        result[boardId] = sortWithFixedBoundaries(statuses).map(boardStatusToColumn);
      });

      return result;
    },
    enabled: ids.length > 0,
    staleTime: 60000,
  });
}
