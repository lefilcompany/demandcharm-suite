import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Plan } from "./usePlans";

export interface UserSubscriptionInfo {
  teamId: string;
  teamName: string;
  subscription: {
    id: string;
    status: string;
    plan: Plan;
  } | null;
}

/**
 * Fetches the logged-in user's teams and their subscriptions
 * without depending on TeamContext (works on public pages like /get-started).
 */
export function useUserSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-subscription", user?.id],
    queryFn: async () => {
      // 1. Get teams the user belongs to
      const { data: memberships, error: memberError } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("user_id", user!.id);

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) return null;

      // 2. For each team, check subscriptions
      const teamIds = memberships.map((m) => m.team_id);

      const { data: subscriptions, error: subError } = await supabase
        .from("subscriptions")
        .select(`*, plan:plans(*)`)
        .in("team_id", teamIds)
        .in("status", ["active", "trialing"])
        .limit(1);

      if (subError) throw subError;

      if (!subscriptions || subscriptions.length === 0) {
        // User has teams but no active subscription
        const team = memberships[0].teams as unknown as { id: string; name: string };
        return {
          teamId: team.id,
          teamName: team.name,
          subscription: null,
        } as UserSubscriptionInfo;
      }

      const sub = subscriptions[0];
      const team = memberships.find((m) => m.team_id === sub.team_id)?.teams as unknown as { id: string; name: string };

      return {
        teamId: sub.team_id,
        teamName: team?.name || "",
        subscription: {
          id: sub.id,
          status: sub.status,
          plan: sub.plan as unknown as Plan,
        },
      } as UserSubscriptionInfo;
    },
    enabled: !!user,
  });
}
