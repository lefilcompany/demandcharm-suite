import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrialCoupon {
  id: string;
  code: string;
  plan_id: string;
  trial_days: number;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  expires_at: string | null;
  plans?: { name: string } | null;
}

export function useAdminCoupons() {
  return useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_coupons" as any)
        .select("*, plans:plan_id(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as TrialCoupon[];
    },
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coupon: {
      code: string;
      plan_id: string;
      trial_days: number;
      max_uses: number;
      description?: string;
      expires_at?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("trial_coupons" as any)
        .insert({ ...coupon, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}

export function useToggleCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("trial_coupons" as any)
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      coupon_id: string;
      plan_id: string;
      trial_days: number;
      max_uses: number;
      description?: string | null;
      expires_at?: string | null;
      propagate: boolean;
    }) => {
      const { data, error } = await supabase.rpc("update_trial_coupon", {
        p_coupon_id: params.coupon_id,
        p_plan_id: params.plan_id,
        p_trial_days: params.trial_days,
        p_max_uses: params.max_uses,
        p_description: params.description ?? null,
        p_expires_at: params.expires_at ?? null,
        p_propagate: params.propagate,
      } as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });
}

export function useCouponRedemptions(couponId: string | null) {
  return useQuery({
    queryKey: ["admin-coupon-redemptions", couponId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_redemptions" as any)
        .select("*, teams:team_id(name), profiles:redeemed_by(full_name)")
        .eq("coupon_id", couponId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!couponId,
  });
}
