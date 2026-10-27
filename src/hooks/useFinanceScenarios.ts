import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { type Scenario } from "@/lib/finance/simulator";

export function useFinanceScenarios(teamId: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-scenarios", teamId, user?.id],
    enabled: enabled && !!user,
    queryFn: async (): Promise<Scenario[]> => {
      const { data, error } = await supabase.from("finance_scenarios").select("*").eq("team_id", teamId).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, gross: Number(s.gross), tax_rate: Number(s.tax_rate), variable_rate: Number(s.variable_rate), margin_target: Number(s.margin_target), team_cost: Number(s.team_cost), planned_hours: Number(s.planned_hours), direct_expenses: Number(s.direct_expenses), shared_costs: Number(s.shared_costs) }));
    },
  });
}