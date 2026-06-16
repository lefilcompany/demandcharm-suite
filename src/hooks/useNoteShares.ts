import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type NoteSharePermission = 'viewer' | 'editor';

interface NoteShare {
  id: string;
  note_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  permission: NoteSharePermission;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface SharedNote {
  id: string;
  title: string;
  content: string | null;
  icon: string | null;
  cover_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  team_id: string;
  is_public: boolean;
  archived: boolean;
  parent_id: string | null;
  permission: NoteSharePermission;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// Get shares for a specific note (for the owner)
export function useNoteShares(noteId: string | null) {
  return useQuery({
    queryKey: ["note-shares", noteId],
    queryFn: async () => {
      if (!noteId) return [];

      const { data, error } = await supabase
        .from("note_shares")
        .select(`
          id,
          note_id,
          shared_with_user_id,
          shared_by_user_id,
          permission,
          created_at
        `)
        .eq("note_id", noteId);

      if (error) throw error;

      // Fetch profiles separately
      const userIds = data.map((s) => s.shared_with_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((share) => ({
        ...share,
        profiles: profileMap.get(share.shared_with_user_id),
      })) as NoteShare[];
    },
    enabled: !!noteId,
  });
}

// Get notes shared with the current user
export function useSharedWithMeNotes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["shared-with-me-notes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get share records with permission
      const { data: shares, error: sharesError } = await supabase
        .from("note_shares")
        .select("note_id, permission, created_at")
        .eq("shared_with_user_id", user.id)
        .order("created_at", { ascending: false });

      if (sharesError) throw sharesError;
      if (!shares || shares.length === 0) return [];

      // Create permission map
      const permissionMap = new Map(shares.map((s) => [s.note_id, s.permission]));

      // Get notes
      const noteIds = shares.map((s) => s.note_id);
      const { data: notes, error: notesError } = await supabase
        .from("notes")
        .select("id, title, content, icon, cover_url, tags, created_at, updated_at, created_by, team_id, is_public, archived, parent_id")
        .in("id", noteIds)
        .eq("archived", false);

      if (notesError) throw notesError;
      if (!notes) return [];

      // Get profiles for note creators
      const creatorIds = [...new Set(notes.map((n) => n.created_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", creatorIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return notes.map((note) => ({
        ...note,
        permission: permissionMap.get(note.id) as NoteSharePermission,
        profiles: profileMap.get(note.created_by),
      })) as SharedNote[];
    },
    enabled: !!user?.id,
  });
}

// Share a note with a user
export function useShareNoteWithUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      noteId,
      userId,
      permission = 'viewer',
    }: {
      noteId: string;
      userId: string;
      permission?: NoteSharePermission;
    }) => {
      if (!user?.id) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("note_shares")
        .insert({
          note_id: noteId,
          shared_with_user_id: userId,
          shared_by_user_id: user.id,
          permission,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Esta nota já foi compartilhada com este usuário");
        }
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["note-shares", variables.noteId] });
      toast.success("Nota compartilhada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update share permission
export function useUpdateNoteSharePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      userId,
      permission,
    }: {
      noteId: string;
      userId: string;
      permission: NoteSharePermission;
    }) => {
      const { error } = await supabase
        .from("note_shares")
        .update({ permission })
        .eq("note_id", noteId)
        .eq("shared_with_user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["note-shares", variables.noteId] });
    },
    onError: () => {
      toast.error("Erro ao atualizar permissão");
    },
  });
}

// Get user's permission for a specific note
export function useNotePermission(noteId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["note-permission", noteId, user?.id],
    queryFn: async () => {
      if (!noteId || !user?.id) return null;

      // Check if user is owner
      const { data: note } = await supabase
        .from("notes")
        .select("created_by")
        .eq("id", noteId)
        .single();

      if (note?.created_by === user.id) {
        return 'owner' as const;
      }

      // Check share permission
      const { data: share } = await supabase
        .from("note_shares")
        .select("permission")
        .eq("note_id", noteId)
        .eq("shared_with_user_id", user.id)
        .single();

      return share?.permission as NoteSharePermission | null;
    },
    enabled: !!noteId && !!user?.id,
  });
}

// Remove share from a note
export function useRemoveNoteShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      userId,
    }: {
      noteId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from("note_shares")
        .delete()
        .eq("note_id", noteId)
        .eq("shared_with_user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["note-shares", variables.noteId] });
      toast.success("Compartilhamento removido");
    },
    onError: () => {
      toast.error("Erro ao remover compartilhamento");
    },
  });
}

// Leave a shared note (user removes their own access)
export function useLeaveSharedNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (noteId: string) => {
      if (!user?.id) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("note_shares")
        .delete()
        .eq("note_id", noteId)
        .eq("shared_with_user_id", user.id);

      if (error) throw error;
      return noteId;
    },
    onMutate: async (noteId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["shared-with-me-notes", user?.id] });

      // Snapshot previous value
      const previousNotes = queryClient.getQueryData<SharedNote[]>(["shared-with-me-notes", user?.id]);

      // Optimistically remove the note from the list
      if (previousNotes) {
        queryClient.setQueryData<SharedNote[]>(
          ["shared-with-me-notes", user?.id],
          previousNotes.filter((note) => note.id !== noteId)
        );
      }

      return { previousNotes };
    },
    onError: (err, noteId, context) => {
      // Rollback on error
      if (context?.previousNotes) {
        queryClient.setQueryData(["shared-with-me-notes", user?.id], context.previousNotes);
      }
      toast.error("Erro ao sair da nota");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-with-me-notes", user?.id] });
    },
    onSuccess: () => {
      toast.success("Você saiu da nota compartilhada");
    },
  });
}
