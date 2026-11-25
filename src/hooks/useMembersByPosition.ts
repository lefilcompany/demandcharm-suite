import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { userIdsInPerformances } from "@/lib/performances";

/** user_ids que pertencem a qualquer uma das performances informadas. */
export function useMembersByPosition(teamId: string | null | undefined, performance: string | string[] | null) {
  const ids = (Array.isArray(performance) ? performance : performance ? [performance] : []).filter(Boolean);
  return useQuery({
    queryKey: ["members-by-position", teamId, [...ids].sort().join(",")],
    queryFn: async () => {
      if (!teamId || ids.length === 0) return [];
      const { data, error } = await supabase
        .from("team_performance_members")
        .select("performance_id, team_members!inner(user_id, team_id)")
        .in("performance_id", ids)
        .eq("team_members.team_id", teamId);
      if (error) throw error;
      return userIdsInPerformances(
        (data ?? []).map((r: any) => ({ performance_id: r.performance_id, user_id: r.team_members?.user_id })),
        ids,
      );
    },
    enabled: !!teamId && ids.length > 0,
  });
}
export const useMembersByPerformance = useMembersByPosition;
