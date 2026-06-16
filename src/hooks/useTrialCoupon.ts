import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useValidateCoupon(code: string) {
  return useQuery({
    queryKey: ["validate-coupon", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_coupons" as any)
        .select("id, code, trial_days, plan_id, plans:plan_id(name)")
        .ilike("code", code.trim())
        .eq("is_active", true)
        .single();

      if (error || !data) return null;
      return data as any;
    },
    enabled: code.trim().length >= 3,
    retry: false,
  });
}

export function useRedeemCoupon() {
  return useMutation({
    mutationFn: async ({ code, teamId }: { code: string; teamId: string }) => {
      const { data, error } = await supabase.rpc("redeem_trial_coupon", {
        p_code: code,
        p_team_id: teamId,
      } as any);

      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        const errorMap: Record<string, string> = {
          invalid_coupon: "Cupom inválido ou expirado",
          already_redeemed: "Este cupom já foi utilizado por esta equipe",
          plan_not_found: "Plano associado ao cupom não encontrado",
          not_authenticated: "Você precisa estar autenticado",
        };
        throw new Error(errorMap[result?.error] || "Erro ao resgatar cupom");
      }
      return result;
    },
  });
}
