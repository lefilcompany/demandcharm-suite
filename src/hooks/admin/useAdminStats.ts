import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [
        teamsRes,
        profilesRes,
        subsRes,
        couponsRes,
        demandsRes,
        trialsRes,
        newUsersRes,
        newTeamsRes,
      ] = await Promise.all([
        supabase.from("teams").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("trial_coupons" as any).select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("demands").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trialing"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabase.from("teams").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      ]);

      return {
        totalTeams: teamsRes.count ?? 0,
        totalUsers: profilesRes.count ?? 0,
        activeSubscriptions: subsRes.count ?? 0,
        activeCoupons: couponsRes.count ?? 0,
        totalDemands: demandsRes.count ?? 0,
        activeTrials: trialsRes.count ?? 0,
        newUsersLast30Days: newUsersRes.count ?? 0,
        newTeamsLast30Days: newTeamsRes.count ?? 0,
      };
    },
  });
}
