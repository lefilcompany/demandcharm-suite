import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Options {
  /** When true, include boards from every team the user belongs to (not just teamId). */
  allTeams?: boolean;
  enabled?: boolean;
}

export function useAllTeamDemands(
  teamId: string | null | undefined,
  options: Options = {}
) {
  const { user } = useAuth();
  const { allTeams = false, enabled = true } = options;

  return useQuery({
    queryKey: ["all-team-demands", allTeams ? "all-teams" : teamId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      if (!allTeams && !teamId) return [];

      // Boards the user is a member of
      const { data: userBoards, error: boardsError } = await supabase
        .from("board_members")
        .select("board_id, boards!inner(id, team_id)")
        .eq("user_id", user.id);

      if (boardsError) throw boardsError;

      const boardIds = (userBoards || [])
        .filter((b: any) => allTeams || b.boards?.team_id === teamId)
        .map((b: any) => b.board_id);

      if (boardIds.length === 0) return [];

      const { data, error } = await supabase
        .from("demands")
        .select(`
          *,
          demand_statuses(id, name, color),
          services(id, name),
          profiles!demands_created_by_fkey(id, full_name, avatar_url),
          assigned_profile:profiles!demands_assigned_to_fkey(id, full_name, avatar_url),
          boards(id, name),
          demand_assignees(
            user_id,
            profile:profiles(id, full_name, avatar_url)
          )
        `)
        .in("board_id", boardIds)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(2000);

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!user && (allTeams || !!teamId),
    staleTime: 30000,
  });
}
