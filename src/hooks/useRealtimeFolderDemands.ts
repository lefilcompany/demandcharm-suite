import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { mergeDemandRowIntoCache } from "@/lib/demandRealtimeCache";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";

/**
 * Keeps a project (folder) view in sync with the real Kanban state.
 * Listens to demand changes across every board present in the project and
 * refreshes the cached team demands so statuses always reflect the board.
 */
export function useRealtimeFolderDemands(folderId: string | null | undefined, boardIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useRef(createRealtimeInstanceId());
  const boardKey = boardIds.slice().sort().join(",");

  useEffect(() => {
    if (!user || !folderId || !boardKey) return;

    const ids = new Set(boardKey.split(","));

    const channel = supabase
      .channel(`folder-demands-${folderId}-${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demands" },
        (payload) => {
          const next = payload.new as Record<string, any> | null;
          const previous = payload.old as Record<string, any> | null;
          const boardId = next?.board_id || previous?.board_id;
          if (boardId && !ids.has(boardId)) return;

          if (next?.id) mergeDemandRowIntoCache(queryClient, next as any);

          queryClient.invalidateQueries({ queryKey: ["all-team-demands"] });
          queryClient.invalidateQueries({ queryKey: ["demands"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_demands" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["folder-demand-ids", folderId] });
          queryClient.invalidateQueries({ queryKey: ["demand-folders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, folderId, boardKey, queryClient]);
}
