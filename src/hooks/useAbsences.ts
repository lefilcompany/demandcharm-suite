import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AbsenceType = "vacation" | "day_off" | "leave" | "other";

export interface Absence {
  id: string;
  team_id: string;
  user_id: string;
  type: AbsenceType;
  starts_on: string;
  ends_on: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: "Férias",
  day_off: "Folga",
  leave: "Licença",
  other: "Outro",
};

/** Lista as ausências de um usuário dentro da equipe. */
export function useAbsences(
  teamId: string | null | undefined,
  userId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["absences", teamId, userId],
    queryFn: async (): Promise<Absence[]> => {
      if (!teamId || !userId) return [];

      const { data, error } = await supabase
        .from("user_absences")
        .select("*")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .order("starts_on", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Absence[];
    },
    enabled: !!teamId && !!userId,
  });
}

export interface CreateAbsenceInput {
  teamId: string;
  type: AbsenceType;
  startsOn: string;
  endsOn: string;
  note?: string | null;
}

export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      type,
      startsOn,
      endsOn,
      note,
    }: CreateAbsenceInput): Promise<Absence | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("user_absences")
        .insert({
          team_id: teamId,
          user_id: user.id,
          type,
          starts_on: startsOn,
          ends_on: endsOn,
          note: note?.trim() || null,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data as Absence | null;
    },
    onSuccess: async (_data, variables) => {
      const { data: { user } } = await supabase.auth.getUser();
      queryClient.invalidateQueries({ queryKey: ["absences", variables.teamId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}

export interface UpdateAbsenceInput {
  absenceId: string;
  teamId: string;
  type?: AbsenceType;
  startsOn?: string;
  endsOn?: string;
  note?: string | null;
}

export function useUpdateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      absenceId,
      type,
      startsOn,
      endsOn,
      note,
    }: UpdateAbsenceInput): Promise<Absence | null> => {
      const payload: Record<string, string | null> = {};
      if (type !== undefined) payload.type = type;
      if (startsOn !== undefined) payload.starts_on = startsOn;
      if (endsOn !== undefined) payload.ends_on = endsOn;
      if (note !== undefined) payload.note = note?.trim() || null;

      const { data, error } = await supabase
        .from("user_absences")
        .update(payload)
        .eq("id", absenceId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data as Absence | null;
    },
    onSuccess: async (_data, variables) => {
      const { data: { user } } = await supabase.auth.getUser();
      queryClient.invalidateQueries({ queryKey: ["absences", variables.teamId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}

export function useDeleteAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ absenceId }: { absenceId: string; teamId: string }) => {
      const { error } = await supabase.from("user_absences").delete().eq("id", absenceId);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      const { data: { user } } = await supabase.auth.getUser();
      queryClient.invalidateQueries({ queryKey: ["absences", variables.teamId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["team-availability", variables.teamId] });
    },
  });
}
