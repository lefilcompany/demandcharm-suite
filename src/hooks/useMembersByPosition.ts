import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMembersByPosition(teamId: string | null | undefined, positionId: string | null) {
  return useQuery({
    queryKey: ["members-by-position", teamId, positionId],
    queryFn: async () => {
      if (!teamId || !positionId) return [];

      const { data, error } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("position_id", positionId);

      if (error) throw error;
      return data.map((m) => m.user_id);
    },
    enabled: !!teamId && !!positionId,
  });
}
