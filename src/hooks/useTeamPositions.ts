import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamPosition {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  color: string;
  text_color: string;
  created_by: string;
  created_at: string;
}

export function useTeamPositions(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["team-positions", teamId],
    queryFn: async () => {
      if (!teamId) return [];

      const { data, error } = await supabase
        .from("team_positions")
        .select("*")
        .eq("team_id", teamId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as TeamPosition[];
    },
    enabled: !!teamId,
  });
}

export function useCreatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      name,
      description,
      color,
      textColor,
    }: {
      teamId: string;
      name: string;
      description?: string;
      color: string;
      textColor?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("team_positions")
        .insert({
          team_id: teamId,
          name: name.trim(),
          description: description?.trim() || null,
          color,
          text_color: textColor || "auto",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um cargo com este nome nesta equipe");
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-positions", variables.teamId] });
    },
  });
}

export function useUpdatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      positionId,
      teamId,
      name,
      description,
      color,
      textColor,
    }: {
      positionId: string;
      teamId: string;
      name: string;
      description?: string;
      color: string;
      textColor?: string;
    }) => {
      const { data, error } = await supabase
        .from("team_positions")
        .update({
          name: name.trim(),
          description: description?.trim() || null,
          color,
          text_color: textColor || "auto",
        })
        .eq("id", positionId)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um cargo com este nome nesta equipe");
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-positions", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ positionId, teamId }: { positionId: string; teamId: string }) => {
      const { error } = await supabase
        .from("team_positions")
        .delete()
        .eq("id", positionId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-positions", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useAssignPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      positionId,
    }: {
      memberId: string;
      positionId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("team_members")
        .update({ position_id: positionId })
        .eq("id", memberId)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}
