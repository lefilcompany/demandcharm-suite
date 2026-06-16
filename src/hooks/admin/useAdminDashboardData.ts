import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, startOfMonth, format, addDays } from "date-fns";

export function useAdminDashboardData() {
  const recentTeamsQuery = useQuery({
    queryKey: ["admin-recent-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, created_at, subscriptions(status, trial_ends_at, plans:plan_id(name))")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recentUsersQuery = useQuery({
    queryKey: ["admin-recent-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const expiringTrialsQuery = useQuery({
    queryKey: ["admin-expiring-trials"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const sevenDaysFromNow = addDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, team_id, trial_ends_at, status, teams:team_id(name)")
        .eq("status", "trialing")
        .gte("trial_ends_at", now)
        .lte("trial_ends_at", sevenDaysFromNow)
        .order("trial_ends_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const planDistributionQuery = useQuery({
    queryKey: ["admin-plan-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_id, plans:plan_id(name)")
        .in("status", ["active", "trialing"]);
      if (error) throw error;

      const counts: Record<string, { name: string; count: number }> = {};
      (data ?? []).forEach((sub: any) => {
        const planName = sub.plans?.name ?? "Sem plano";
        if (!counts[planName]) counts[planName] = { name: planName, count: 0 };
        counts[planName].count++;
      });
      return Object.values(counts);
    },
  });

  const monthlyGrowthQuery = useQuery({
    queryKey: ["admin-monthly-growth"],
    queryFn: async () => {
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString();

      const [usersRes, teamsRes] = await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", sixMonthsAgo),
        supabase.from("teams").select("created_at").gte("created_at", sixMonthsAgo),
      ]);

      const months: Record<string, { month: string; users: number; teams: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(d, "yyyy-MM");
        const label = format(d, "MMM");
        months[key] = { month: label, users: 0, teams: 0 };
      }

      (usersRes.data ?? []).forEach((u) => {
        const key = format(new Date(u.created_at), "yyyy-MM");
        if (months[key]) months[key].users++;
      });
      (teamsRes.data ?? []).forEach((t) => {
        const key = format(new Date(t.created_at), "yyyy-MM");
        if (months[key]) months[key].teams++;
      });

      return Object.values(months);
    },
  });

  return {
    recentTeams: recentTeamsQuery,
    recentUsers: recentUsersQuery,
    expiringTrials: expiringTrialsQuery,
    planDistribution: planDistributionQuery,
    monthlyGrowth: monthlyGrowthQuery,
  };
}
