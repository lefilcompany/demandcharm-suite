import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";
import { usePlansModal } from "@/contexts/PlansModalContext";
import { showPlanLimitToast } from "@/lib/planLimitErrors";

export interface Note {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  content: string | null;
  icon: string;
  cover_url: string | null;
  is_public: boolean;
  archived: boolean;
  parent_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export function useNotes() {
  const { selectedTeamId } = useSelectedTeam();
  const queryClient = useQueryClient();
  const instanceId = useRef(createRealtimeInstanceId());

  // Realtime subscription for notes
  useEffect(() => {
    if (!selectedTeamId) return;

    const channel = supabase
      .channel(`notes-${selectedTeamId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `team_id=eq.${selectedTeamId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notes", selectedTeamId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTeamId, queryClient]);

  return useQuery({
    queryKey: ["notes", selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return [];

      const { data, error } = await supabase
        .from("notes")
        .select(`
          *,
          profiles:created_by (id, full_name, avatar_url)
        `)
        .eq("team_id", selectedTeamId)
        .eq("archived", false)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
    enabled: !!selectedTeamId,
  });
}

export function useNote(noteId: string | null) {
  return useQuery({
    queryKey: ["note", noteId],
    queryFn: async () => {
      if (!noteId) return null;

      const { data, error } = await supabase
        .from("notes")
        .select(`
          *,
          profiles:created_by (id, full_name, avatar_url)
        `)
        .eq("id", noteId)
        .single();

      if (error) throw error;
      return data as Note;
    },
    enabled: !!noteId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  const { openPlans } = usePlansModal();

  return useMutation({
    mutationFn: async (data: { title?: string; content?: string; icon?: string; parent_id?: string }) => {
      if (!user || !selectedTeamId) throw new Error("Usuário ou equipe não encontrado");

      let finalTitle = data.title || "Sem título";

      // If no custom title provided, generate unique "Sem título" with number
      if (!data.title) {
        // Get existing notes with "Sem título" pattern
        const { data: existingNotes } = await supabase
          .from("notes")
          .select("title")
          .eq("team_id", selectedTeamId)
          .ilike("title", "Sem título%");

        if (existingNotes && existingNotes.length > 0) {
          // Extract numbers from existing titles
          const numbers = existingNotes.map(note => {
            const match = note.title.match(/^Sem título\s*(\d*)$/i);
            if (match) {
              return match[1] ? parseInt(match[1], 10) : 1;
            }
            return 0;
          }).filter(n => n > 0);

          // Find next available number
          const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
          finalTitle = maxNumber === 0 ? "Sem título" : `Sem título ${maxNumber + 1}`;
        }
      }

      const { data: note, error } = await supabase
        .from("notes")
        .insert({
          team_id: selectedTeamId,
          created_by: user.id,
          title: finalTitle,
          content: data.content || "",
          icon: data.icon || "📝",
          parent_id: data.parent_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error: Error) => {
      if (showPlanLimitToast(error, openPlans)) return;
      toast.error("Erro ao criar nota: " + error.message);
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, ...data }: { 
      noteId: string; 
      title?: string; 
      content?: string; 
      icon?: string;
      cover_url?: string | null;
      archived?: boolean;
      tags?: string[];
    }) => {
      const { data: note, error } = await supabase
        .from("notes")
        .update(data)
        .eq("id", noteId)
        .select()
        .single();

      if (error) throw error;
      return note;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note", variables.noteId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar nota: " + error.message);
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota excluída");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir nota: " + error.message);
    },
  });
}
