import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { Plan } from "./usePlans";

export interface Subscription {
  id: string;
  team_id: string;
  plan_id: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "inactive";
  current_period_start: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export function useTeamSubscription(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["subscription", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          plan:plans(*)
        `)
        .eq("team_id", id!)
        .maybeSingle();

      if (error) throw error;
      return data as (Subscription & { plan: Plan }) | null;
    },
    enabled: !!id,
  });
}

export function useSubscriptionLimits(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;
  const { data: subscription, isLoading } = useTeamSubscription(id);

  // Default to Starter plan limits if no subscription
  const starterLimits = {
    max_boards: 1,
    max_members: 3,
    max_demands_per_month: 30,
    max_services: 5,
    max_notes: 0,
    features: {
      time_tracking: "basic",
      notifications: "in_app",
      support: "docs",
    },
  };

  const limits = subscription?.plan
    ? {
        max_boards: subscription.plan.max_boards,
        max_members: subscription.plan.max_members,
        max_demands_per_month: subscription.plan.max_demands_per_month,
        max_services: subscription.plan.max_services,
        max_notes: subscription.plan.max_notes,
        features: subscription.plan.features,
      }
    : starterLimits;

  return {
    limits,
    plan: subscription?.plan,
    subscription,
    isLoading,
    isUnlimited: (limit: number) => limit === -1,
  };
}

export function useCurrentUsage(teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;

  return useQuery({
    queryKey: ["usage", id],
    queryFn: async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from("usage_records")
        .select("*")
        .eq("team_id", id!)
        .eq("period_start", periodStart)
        .maybeSingle();

      if (error) throw error;

      // Return default usage if no record exists
      return data || {
        demands_created: 0,
        members_count: 0,
        boards_count: 0,
        notes_count: 0,
        storage_bytes: 0,
      };
    },
    enabled: !!id,
  });
}

export function useCanCreateResource(resourceType: "demands" | "boards" | "members" | "notes") {
  const { limits, isLoading: limitsLoading, isUnlimited } = useSubscriptionLimits();
  const { data: usage, isLoading: usageLoading } = useCurrentUsage();
  const { selectedTeamId } = useSelectedTeam();

  const isLoading = limitsLoading || usageLoading;

  if (isLoading || !usage) {
    return { canCreate: true, isLoading: true, remaining: null };
  }

  let limit: number;
  let used: number;

  switch (resourceType) {
    case "demands":
      limit = limits.max_demands_per_month;
      used = usage.demands_created;
      break;
    case "boards":
      limit = limits.max_boards;
      used = usage.boards_count;
      break;
    case "members":
      limit = limits.max_members;
      used = usage.members_count;
      break;
    case "notes":
      limit = limits.max_notes;
      used = usage.notes_count;
      break;
    default:
      return { canCreate: true, isLoading: false, remaining: null };
  }

  if (isUnlimited(limit)) {
    return { canCreate: true, isLoading: false, remaining: null, isUnlimited: true };
  }

  const remaining = Math.max(0, limit - used);
  const canCreate = remaining > 0;

  return { canCreate, isLoading: false, remaining, limit, used };
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      planId,
      stripeSubscriptionId,
      stripeCustomerId,
      periodEnd,
    }: {
      teamId: string;
      planId: string;
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
      periodEnd?: string;
    }) => {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          team_id: teamId,
          plan_id: planId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: stripeCustomerId,
          current_period_end: periodEnd,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subscription", variables.teamId] });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      planId,
      status,
      cancelAtPeriodEnd,
    }: {
      subscriptionId: string;
      planId?: string;
      status?: string;
      cancelAtPeriodEnd?: boolean;
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (planId) updates.plan_id = planId;
      if (status) updates.status = status;
      if (cancelAtPeriodEnd !== undefined) updates.cancel_at_period_end = cancelAtPeriodEnd;

      const { data, error } = await supabase
        .from("subscriptions")
        .update(updates as never)
        .eq("id", subscriptionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subscription", data.team_id] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subscription", data.team_id] });
    },
  });
}
