import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import type { MemberKind, ModuleAccess } from "@/lib/access/profiles";

export function useModuleAccess() {
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  return useQuery({
    queryKey: ["module-access", selectedTeamId, user?.id],
    enabled: !!selectedTeamId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_module_access", { _team_id: selectedTeamId! });
      if (error) throw error;
      return data as unknown as ModuleAccess;
    },
  });
}

/** user_id -> member kind for the selected team. */
export function useMemberKinds() {
  const { selectedTeamId } = useSelectedTeam();
  return useQuery({
    queryKey: ["member-kinds", selectedTeamId],
    enabled: !!selectedTeamId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("user_id, member_kind").eq("team_id", selectedTeamId!);
      if (error) throw error;
      return new Map((data ?? []).map((r: any) => [r.user_id, r.member_kind as MemberKind]));
    },
  });
}
