import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamHoliday {
  id: string;
  team_id: string;
  date: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Feriados da equipe (visíveis a qualquer membro por RLS). */
export function useTeamHolidays(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["team-holidays", teamId],
    queryFn: async (): Promise<TeamHoliday[]> => {
      if (!teamId) return [];

      const { data, error } = await supabase
        .from("team_holidays")
        .select("*")
        .eq("team_id", teamId)
        .order("date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as TeamHoliday[];
    },
    enabled: !!teamId,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      date,
      name,
    }: {
      teamId: string;
      date: string;
      name: string;
    }): Promise<TeamHoliday | null> => {
      const { data, error } = await supabase
        .from("team_holidays")
        .insert({ team_id: teamId, date, name: name.trim() })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um feriado cadastrado nesta data");
        }
        throw error;
      }
      return data as TeamHoliday | null;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-holidays", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      holidayId,
      date,
      name,
    }: {
      holidayId: string;
      teamId: string;
      date?: string;
      name?: string;
    }): Promise<TeamHoliday | null> => {
      const payload: { date?: string; name?: string } = {};
      if (date !== undefined) payload.date = date;
      if (name !== undefined) payload.name = name.trim();

      const { data, error } = await supabase
        .from("team_holidays")
        .update(payload)
        .eq("id", holidayId)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um feriado cadastrado nesta data");
        }
        throw error;
      }
      return data as TeamHoliday | null;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-holidays", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ holidayId }: { holidayId: string; teamId: string }) => {
      const { error } = await supabase.from("team_holidays").delete().eq("id", holidayId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-holidays", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}
