import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useCanManageFinance(teamId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-can-manage", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_finance_permission", { _user_id: user!.id, _permission: "finance.manage_settings", _team_id: teamId!, _board_id: null as any });
      if (error) throw error;
      return !!data;
    },
  });
}

export function useTeamBoards(teamId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team-boards-lite", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("boards").select("id, name").eq("team_id", teamId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectBoards(teamId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-boards", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_boards").select("*").eq("team_id", teamId!).order("valid_from", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePendingDemands(teamId: string | null, competence: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-pending-demands", teamId, competence, user?.id],
    enabled: enabled && !!teamId && !!user,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_pending_demands", { _team_id: teamId!, _competence: competence });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMemberProfiles(teamId: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-member-profiles", teamId, user?.id],
    enabled: enabled && !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_member_profiles").select("*").eq("team_id", teamId!).order("valid_from", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidateProjectFinance() {
  const qc = useQueryClient();
  return () => {
    ["project-boards", "finance-pending-demands", "finance-member-profiles", "demand-folders"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

export function useFinanceMutation<T>(fn: (v: T) => Promise<unknown>) {
  const invalidate = useInvalidateProjectFinance();
  return useMutation({ mutationFn: fn, onSuccess: invalidate });
}
