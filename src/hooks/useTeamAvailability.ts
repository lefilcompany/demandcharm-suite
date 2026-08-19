import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AbsenceType } from "@/hooks/useAbsences";

export type AvailabilityStatus =
  | "available"
  | "outside_hours"
  | "day_off"
  | "vacation"
  | "leave"
  | "other_absence"
  | "holiday"
  | "unconfigured";

export interface TeamMemberAvailability {
  user_id: string;
  status: AvailabilityStatus;
  available_now: boolean;
  status_label: string;
  work_start_time: string | null;
  work_end_time: string | null;
  absence_type: AbsenceType | null;
  absence_starts_on: string | null;
  absence_ends_on: string | null;
  holiday_name: string | null;
  next_available_at: string | null;
}

/**
 * Disponibilidade de todos os membros da equipe em uma única chamada à RPC.
 * `at` permite simular um momento específico (ISO string).
 */
export function useTeamAvailability(
  teamId: string | null | undefined,
  at?: string,
) {
  return useQuery({
    queryKey: ["team-availability", teamId, at ?? null],
    queryFn: async (): Promise<TeamMemberAvailability[]> => {
      if (!teamId) return [];

      const { data, error } = await supabase.rpc("get_team_availability", {
        p_team_id: teamId,
        ...(at ? { p_at: at } : {}),
      });

      if (error) throw error;
      return (data ?? []) as TeamMemberAvailability[];
    },
    enabled: !!teamId,
    staleTime: 60_000,
    // "Disponível agora" precisa acompanhar a passagem do tempo.
    refetchInterval: at ? false : 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}
