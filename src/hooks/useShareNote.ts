import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface NoteShareToken {
  id: string;
  note_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export function useNoteShareToken(noteId: string | null) {
  return useQuery({
    queryKey: ["note-share-token", noteId],
    queryFn: async () => {
      if (!noteId) return null;

      const { data, error } = await supabase
        .from("note_share_tokens")
        .select("*")
        .eq("note_id", noteId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as NoteShareToken | null;
    },
    enabled: !!noteId,
  });
}

export function useCreateNoteShareToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (noteId: string) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Generate a random token
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

      const { data, error } = await supabase
        .from("note_share_tokens")
        .insert({
          note_id: noteId,
          token,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as NoteShareToken;
    },
    onSuccess: (_, noteId) => {
      queryClient.invalidateQueries({ queryKey: ["note-share-token", noteId] });
      toast.success("Link de compartilhamento criado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar link: " + error.message);
    },
  });
}

export function useRevokeNoteShareToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tokenId, noteId }: { tokenId: string; noteId: string }) => {
      const { error } = await supabase
        .from("note_share_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ["note-share-token", noteId] });
      toast.success("Link de compartilhamento revogado");
    },
    onError: (error: Error) => {
      toast.error("Erro ao revogar link: " + error.message);
    },
  });
}

export function useSharedNote(token: string | null) {
  return useQuery({
    queryKey: ["shared-note", token],
    queryFn: async () => {
      if (!token) return null;

      // Verify the token via secure RPC (avoids exposing all tokens)
      const { data: tokenRows, error: tokenError } = await supabase
        .rpc("verify_note_share_token", { p_token: token });

      const tokenData = tokenRows?.[0] ?? null;
      if (tokenError || !tokenData) return null;

      // Then get the note
      const { data: note, error: noteError } = await supabase
        .from("notes")
        .select(`
          *,
          profiles:created_by (id, full_name, avatar_url)
        `)
        .eq("id", tokenData.note_id)
        .single();

      if (noteError) throw noteError;
      return note;
    },
    enabled: !!token,
  });
}
