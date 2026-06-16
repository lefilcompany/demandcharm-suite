import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useAllTeamDemands(teamId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-team-demands", teamId, user?.id],
    queryFn: async () => {
      if (!teamId || !user) return [];

      // First get the boards the user is a member of in this team
      const { data: userBoards, error: boardsError } = await supabase
        .from("board_members")
        .select("board_id, boards!inner(id, team_id)")
        .eq("user_id", user.id);

      if (boardsError) throw boardsError;

      // Filter to only boards in this team
      const boardIds = (userBoards || [])
        .filter((b: any) => b.boards?.team_id === teamId)
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
        .limit(1000);

      if (error) throw error;
      return data || [];
    },
    enabled: !!teamId && !!user,
    staleTime: 30000,
  });
}
