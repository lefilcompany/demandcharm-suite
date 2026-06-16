import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { usePlansModal } from "@/contexts/PlansModalContext";
import { toast } from "sonner";

export type PlanResource = "boards" | "members" | "demands" | "services" | "notes";

interface PlanLimitStatus {
  allowed: boolean;
  message?: string | null;
  plan?: string | null;
  limit?: number | null;
  used?: number | null;
}

async function fetchPlanLimit(teamId: string, resource: PlanResource): Promise<PlanLimitStatus> {
  const { data, error } = await supabase.rpc("check_plan_limit", {
    _team_id: teamId,
    _resource: resource,
  });
  if (error) {
    // On error, fail-open so we don't block users due to network issues.
    return { allowed: true };
  }
  return (data as unknown as PlanLimitStatus) ?? { allowed: true };
}

export function usePlanLimitStatus(resource: PlanResource, teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;
  return useQuery({
    queryKey: ["plan-limit", id, resource],
    queryFn: () => fetchPlanLimit(id!, resource),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Returns an async guard that checks the plan limit before running `action`.
 * If the limit is hit, shows a toast with "Ver planos" and does NOT call `action`.
 */
export function usePlanLimitGuard(resource: PlanResource, teamId?: string) {
  const { selectedTeamId } = useSelectedTeam();
  const id = teamId || selectedTeamId;
  const { openPlans } = usePlansModal();
  const queryClient = useQueryClient();

  const guard = useCallback(
    async (action?: () => void): Promise<boolean> => {
      if (!id) {
        action?.();
        return true;
      }
      // Always re-fetch fresh on guarded clicks to avoid stale allow.
      const status = await queryClient.fetchQuery({
        queryKey: ["plan-limit", id, resource],
        queryFn: () => fetchPlanLimit(id, resource),
        staleTime: 0,
      });
      if (status.allowed) {
        action?.();
        return true;
      }
      toast.error(status.message || "Limite do plano atingido.", {
        duration: 8000,
        action: { label: "Ver planos", onClick: () => openPlans() },
      });
      return false;
    },
    [id, resource, queryClient, openPlans],
  );

  return guard;
}
