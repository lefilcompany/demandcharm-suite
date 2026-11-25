import { useMemo } from "react";
import { userIdsInPerformances } from "@/lib/performances";
import { useTeamPerformanceStaff } from "@/hooks/useTeamPositions";

/** user_ids que pertencem a qualquer uma das performances informadas (usa o cache único da equipe). */
export function useMembersByPosition(teamId: string | null | undefined, performance: string | string[] | null) {
  const ids = (Array.isArray(performance) ? performance : performance ? [performance] : []).filter(Boolean);
  const key = [...ids].sort().join(",");
  const q = useTeamPerformanceStaff(ids.length ? teamId : null);
  const data = useMemo(
    () => (ids.length && q.data ? userIdsInPerformances(q.data, ids) : ids.length ? undefined : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, key],
  );
  return { ...q, data } as typeof q & { data: string[] | undefined };
}
export const useMembersByPerformance = useMembersByPosition;
