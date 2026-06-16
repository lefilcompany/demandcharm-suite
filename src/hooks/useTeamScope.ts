import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedTeam } from "@/contexts/TeamContext";

export interface TeamScope {
  scope_description: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  active: boolean;
}

const EMPTY_TEAM_SCOPE: TeamScope = {
  scope_description: null,
  contract_start_date: null,
  contract_end_date: null,
  active: true,
};

export function useTeamScope(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["team-scope", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("scope_description, contract_start_date, contract_end_date, active")
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      return (data as TeamScope | null) ?? EMPTY_TEAM_SCOPE;
    },
    enabled: !!id,
  });
}

export function useMonthlyDemandCount(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return useQuery({
    queryKey: ["monthly-demand-count", id, month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_monthly_demand_count", {
          _team_id: id!,
          _month: month,
          _year: year,
        });

      if (error) throw error;
      return data as number;
    },
    enabled: !!id,
  });
}

export function useCanCreateDemand(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["can-create-demand", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("can_create_demand", {
          _team_id: id!,
        });

      if (error) throw error;
      return data as boolean;
    },
    enabled: !!id,
  });
}

export function useDemandsByStatus(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["demands-by-status", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select(`
          id,
          title,
          created_at,
          status_id,
          demand_statuses!inner(name, color)
        `)
        .eq("team_id", id!)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by status
      const byStatus: Record<string, { count: number; name: string; color: string }> = {};
      
      data.forEach((demand: any) => {
        const statusName = demand.demand_statuses?.name || "Sem status";
        const statusColor = demand.demand_statuses?.color || "#6B7280";
        
        if (!byStatus[statusName]) {
          byStatus[statusName] = { count: 0, name: statusName, color: statusColor };
        }
        byStatus[statusName].count++;
      });

      return {
        demands: data,
        byStatus: Object.values(byStatus),
        total: data.length,
      };
    },
    enabled: !!id,
  });
}
