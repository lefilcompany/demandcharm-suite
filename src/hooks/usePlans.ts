import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  billing_period: string;
  currency: string;
  price_cents_monthly: number;
  price_cents_yearly: number;
  promo_price_cents_monthly: number | null;
  promo_price_cents_yearly: number | null;
  max_teams: number;
  max_boards: number;
  max_members: number;
  max_demands_per_month: number;
  max_services: number;
  max_notes: number;
  features: {
    time_tracking?: string;
    notifications?: string;
    support?: string;
    reports?: string;
    share_external?: boolean;
    ai_summary?: boolean;
    contracts?: boolean;
    api?: boolean;
    sla?: boolean;
  };
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
  });
}

export function usePlanDetails(planId?: string) {
  return useQuery({
    queryKey: ["plan", planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("id", planId!)
        .single();

      if (error) throw error;
      return data as Plan;
    },
    enabled: !!planId,
  });
}

export function usePlanBySlug(slug?: string) {
  return useQuery({
    queryKey: ["plan-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("slug", slug!)
        .single();

      if (error) throw error;
      return data as Plan;
    },
    enabled: !!slug,
  });
}
