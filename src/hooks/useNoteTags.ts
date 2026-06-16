import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { toast } from "sonner";

export interface NoteTag {
  id: string;
  team_id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
}

export function useNoteTags() {
  const { selectedTeamId } = useSelectedTeam();

  return useQuery({
    queryKey: ["note-tags", selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return [];

      const { data, error } = await supabase
        .from("note_tags")
        .select("*")
        .eq("team_id", selectedTeamId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as NoteTag[];
    },
    enabled: !!selectedTeamId,
  });
}

export function useCreateNoteTag() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      if (!user || !selectedTeamId) throw new Error("Usuário ou equipe não encontrado");

      const { data: tag, error } = await supabase
        .from("note_tags")
        .insert({
          team_id: selectedTeamId,
          created_by: user.id,
          name: data.name.toLowerCase().trim(),
          color: data.color || "#6366f1",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Esta tag já existe");
        }
        throw error;
      }
      return tag as NoteTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note-tags"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteNoteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("note_tags")
        .delete()
        .eq("id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note-tags"] });
      toast.success("Tag removida");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover tag: " + error.message);
    },
  });
}
