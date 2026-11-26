import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type FinancePreset = {
  id: string; team_id: string; name: string; description: string | null;
  tax_rate: number; variable_rate: number; margin_target: number; max_discount: number;
  is_default: boolean; archived_at: string | null;
};

/** Perfis de configuração financeira ativos da equipe (vazio para quem não tem acesso financeiro). */
export function useFinancePresets(teamId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance-presets", teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_config_presets").select("*")
        .eq("team_id", teamId!).is("archived_at", null).order("is_default", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as FinancePreset[];
    },
  });
}
