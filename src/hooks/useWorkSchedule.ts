import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WorkSchedule {
  id: string;
  team_id: string;
  user_id: string;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkScheduleInput {
  weekday: Weekday;
  start_time: string;
  end_time: string;
  is_enabled: boolean;
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

/** Horário de trabalho do usuário autenticado (ou de um usuário específico) na equipe. */
export function useWorkSchedule(
  teamId: string | null | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["work-schedule", teamId, userId],
    queryFn: async (): Promise<WorkSchedule[]> => {
      if (!teamId || !userId) return [];

      const { data, error } = await supabase
        .from("user_work_schedules")
        .select("*")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .order("weekday", { ascending: true });

      if (error) throw error;
      return (data ?? []) as WorkSchedule[];
    },
    enabled: !!teamId && !!userId,
  });
}

/** Salva (upsert) um ou vários dias do expediente do próprio usuário. */
export function useSaveWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      days,
    }: {
      teamId: string;
      days: WorkScheduleInput[];
    }): Promise<WorkSchedule[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const rows = days.map((day) => ({
        team_id: teamId,
        user_id: user.id,
        weekday: day.weekday,
        start_time: day.start_time,
        end_time: day.end_time,
        is_enabled: day.is_enabled,
      }));

      const { data, error } = await supabase
        .from("user_work_schedules")
        .upsert(rows, { onConflict: "team_id,user_id,weekday" })
        .select();

      if (error) throw error;
      return (data ?? []) as WorkSchedule[];
    },
    onSuccess: async (_data, variables) => {
      const { data: { user } } = await supabase.auth.getUser();
      queryClient.invalidateQueries({
        queryKey: ["work-schedule", variables.teamId, user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}

/** Remove a configuração de um dia da semana do próprio usuário. */
export function useDeleteWorkScheduleDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId }: { scheduleId: string; teamId: string }) => {
      const { error } = await supabase
        .from("user_work_schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      const { data: { user } } = await supabase.auth.getUser();
      queryClient.invalidateQueries({
        queryKey: ["work-schedule", variables.teamId, user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}
