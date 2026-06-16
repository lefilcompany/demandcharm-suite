import { useTeamSubscription } from "@/hooks/useSubscription";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { isPast, parseISO, differenceInCalendarDays } from "date-fns";

export interface TrialStatus {
  isLoading: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  totalTrialDays: number;
}

export function useTrialStatus(): TrialStatus {
  const { currentTeam } = useSelectedTeam();
  const { data: subscription, isLoading: isLoadingRaw, fetchStatus } = useTeamSubscription(currentTeam?.id);

  // React Query keeps isLoading=true when `enabled: false` (status pending + fetchStatus idle).
  // Treat as loading only when there's a team AND a request is actually in-flight.
  const isLoading = !!currentTeam?.id && isLoadingRaw && fetchStatus !== "idle";

  // If subscription is trialing, use subscription.trial_ends_at
  const isTrialing = subscription?.status === "trialing";
  const trialEndsAt = isTrialing && subscription?.trial_ends_at
    ? parseISO(subscription.trial_ends_at)
    : null;

  const isTrialExpired = trialEndsAt ? isPast(trialEndsAt) : !isTrialing;
  const isTrialActive = trialEndsAt ? !isPast(trialEndsAt) : false;
  const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  // Calculate total trial days from period start to trial end
  const totalTrialDays = (isTrialing && subscription?.current_period_start && subscription?.trial_ends_at)
    ? Math.max(1, differenceInCalendarDays(parseISO(subscription.trial_ends_at), parseISO(subscription.current_period_start)))
    : 30; // fallback

  return {
    isLoading,
    isTrialActive,
    isTrialExpired,
    trialEndsAt,
    daysRemaining,
    totalTrialDays,
  };
}
