import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type TeamRole = "owner" | "member";
export type TeamMembershipRole = "admin" | "moderator" | "executor" | "requester";

// Map DB team_role enum to simplified UI roles
function mapDbRoleToTeamRole(dbRole: string | null): TeamRole | null {
  if (!dbRole) return null;
  return dbRole === "admin" ? "owner" : "member";
}

export function useTeamRole(teamId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-role", teamId, user?.id],
    queryFn: async () => {
      if (!user || !teamId) return null;

      const { data, error } = await supabase
        .from("team_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return mapDbRoleToTeamRole(data?.role ?? null);
    },
    enabled: !!user && !!teamId,
  });
}

// Raw team membership role from DB enum (admin/moderator/executor/requester)
export function useTeamMembershipRole(teamId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-membership-role", teamId, user?.id],
    queryFn: async () => {
      if (!user || !teamId) return null;

      const { data, error } = await supabase
        .from("team_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return (data?.role as TeamMembershipRole | null) ?? null;
    },
    enabled: !!user && !!teamId,
  });
}

export function useIsTeamAdmin(teamId: string | null) {
  const { data: role, isLoading } = useTeamRole(teamId);
  return { isAdmin: role === "owner", isLoading };
}

export function useIsTeamOwner(teamId: string | null) {
  const { data: role, isLoading } = useTeamRole(teamId);
  return { isOwner: role === "owner", isLoading };
}

// Keep for backward compat - maps to owner check
export function useIsTeamAdminOrModerator(teamId: string | null) {
  const { data: role, isLoading } = useTeamRole(teamId);
  return { 
    canManage: role === "owner", 
    isAdmin: role === "owner",
    isModerator: false,
    isLoading 
  };
}

// Board-level permission hooks
export function useCanInteractKanban(boardRole: string | null | undefined) {
  return { 
    canInteract: boardRole === "admin" || boardRole === "moderator" || boardRole === "executor",
  };
}
