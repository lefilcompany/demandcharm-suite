import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type TeamDefaultsRow = {
  id: string; valid_from: string; tax_rate: number; margin_target: number; variable_rate: number;
  allocation_pct: number; max_discount: number; hourly_cost: number;
};

export function useTeamDefaults(teamId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-team-defaults", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_team_defaults").select("*").eq("team_id", teamId!).order("valid_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeamDefaultsRow[];
    },
  });
}
