import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { notifyBoardMemberChange } from "@/lib/boardMemberNotifications";
import { usePlansModal } from "@/contexts/PlansModalContext";
import { showPlanLimitToast } from "@/lib/planLimitErrors";

export type BoardRole = "admin" | "moderator" | "executor" | "requester";

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: BoardRole;
  added_by: string | null;
  joined_at: string;
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string | null;
    job_title: string | null;
  };
}

// Helper: busca o nome do quadro
async function fetchBoardName(boardId: string): Promise<string> {
  const { data } = await supabase
    .from("boards")
    .select("name")
    .eq("id", boardId)
    .maybeSingle();
  return data?.name ?? "Quadro";
}

// Helper: busca o nome do ator (do profiles)
async function fetchActorName(actorId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", actorId)
    .maybeSingle();
  return data?.full_name ?? "Um administrador";
}

// Fetch board members with their board role
export function useBoardMembers(boardId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["board-members", boardId],
    queryFn: async () => {
      if (!boardId) return [];

      const { data, error } = await supabase
        .from("board_members")
        .select(`
          id,
          board_id,
          user_id,
          role,
          added_by,
          joined_at,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            email,
            job_title
          )
        `)
        .eq("board_id", boardId)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      const roleOrder: Record<string, number> = {
        admin: 0,
        moderator: 1,
        executor: 2,
        requester: 3,
      };

      return data
        .map((member: any) => ({
          id: member.id,
          board_id: member.board_id,
          user_id: member.user_id,
          role: member.role as BoardRole,
          added_by: member.added_by,
          joined_at: member.joined_at,
          profile: member.profiles,
        }))
        .sort((a: BoardMember, b: BoardMember) => {
          const orderA = roleOrder[a.role] ?? 99;
          const orderB = roleOrder[b.role] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          const nameA = a.profile?.full_name || "";
          const nameB = b.profile?.full_name || "";
          return nameA.localeCompare(nameB);
        }) as BoardMember[];
    },
    enabled: !!user && !!boardId,
  });
}

// Get user's role in a board (from board_members table)
export function useBoardRole(boardId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["board-role", boardId, user?.id],
    queryFn: async () => {
      if (!boardId || !user) return null;

      const { data, error } = await supabase
        .from("board_members")
        .select("role")
        .eq("board_id", boardId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return (data?.role as BoardRole) ?? null;
    },
    enabled: !!user && !!boardId,
  });
}

// Add member to board with specified role
export function useAddBoardMember() {
  const queryClient = useQueryClient();
  const { openPlans } = usePlansModal();

  return useMutation({
    mutationFn: async ({
      boardId,
      userId,
      addedBy,
      role,
    }: {
      boardId: string;
      userId: string;
      addedBy: string;
      role: BoardRole;
    }) => {
      const { data, error } = await supabase
        .from("board_members")
        .insert({
          board_id: boardId,
          user_id: userId,
          added_by: addedBy,
          role: role,
        })
        .select()
        .single();

      if (error) throw error;

      // Disparar notificações multicanal (não-bloqueante para a UX)
      try {
        const [boardName, actorName] = await Promise.all([
          fetchBoardName(boardId),
          fetchActorName(addedBy),
        ]);
        await notifyBoardMemberChange({
          event: "added",
          userId,
          boardId,
          boardName,
          newRole: role,
          actorId: addedBy,
          actorName,
        });
      } catch (notifyErr) {
        console.warn("[useAddBoardMember] notification failed:", notifyErr);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["board-members", data.board_id] });
      queryClient.invalidateQueries({ queryKey: ["available-team-members"] });
    },
    onError: (error: Error) => {
      if (showPlanLimitToast(error, openPlans)) return;
      if (error.message.includes("duplicate")) {
        toast.error("Este membro já está no quadro");
      } else {
        toast.error(error.message || "Erro ao adicionar membro");
      }
    },
  });
}

// Update member role in board
export function useUpdateBoardMemberRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      memberId,
      boardId,
      newRole,
    }: {
      memberId: string;
      boardId: string;
      newRole: BoardRole;
    }) => {
      // Buscar dados antes do update para conseguir oldRole + user_id
      const { data: existing, error: fetchErr } = await supabase
        .from("board_members")
        .select("user_id, role")
        .eq("id", memberId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!existing) throw new Error("Membro não encontrado");

      const oldRole = existing.role as BoardRole;
      const targetUserId = existing.user_id as string;

      const { data, error } = await supabase
        .from("board_members")
        .update({ role: newRole })
        .eq("id", memberId)
        .select()
        .single();

      if (error) throw error;

      // Notificar somente se realmente mudou
      if (oldRole !== newRole && user?.id) {
        try {
          const [boardName, actorName] = await Promise.all([
            fetchBoardName(boardId),
            fetchActorName(user.id),
          ]);
          await notifyBoardMemberChange({
            event: "role_changed",
            userId: targetUserId,
            boardId,
            boardName,
            newRole,
            oldRole,
            actorId: user.id,
            actorName,
          });
        } catch (notifyErr) {
          console.warn("[useUpdateBoardMemberRole] notification failed:", notifyErr);
        }
      }

      return { ...data, boardId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["board-members", data.boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-role"] });
      toast.success("Cargo atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar cargo");
    },
  });
}

// Remove member from board
export function useRemoveBoardMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      memberId,
      boardId,
    }: {
      memberId: string;
      boardId: string;
    }) => {
      // Buscar dados antes do delete (precisamos do user_id e role para a notificação)
      const { data: existing, error: fetchErr } = await supabase
        .from("board_members")
        .select("user_id, role")
        .eq("id", memberId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const removedUserId = existing?.user_id as string | undefined;
      const removedRole = (existing?.role as BoardRole | undefined) ?? "executor";

      const { error } = await supabase
        .from("board_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // Notificar usuário removido (se diferente do ator)
      if (removedUserId && user?.id) {
        try {
          const [boardName, actorName] = await Promise.all([
            fetchBoardName(boardId),
            fetchActorName(user.id),
          ]);
          await notifyBoardMemberChange({
            event: "removed",
            userId: removedUserId,
            boardId,
            boardName,
            newRole: removedRole,
            actorId: user.id,
            actorName,
          });
        } catch (notifyErr) {
          console.warn("[useRemoveBoardMember] notification failed:", notifyErr);
        }
      }

      return { memberId, boardId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["board-members", data.boardId] });
      queryClient.invalidateQueries({ queryKey: ["available-team-members"] });
      toast.success("Membro removido do quadro!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao remover membro");
    },
  });
}

// Get team members not in board (for adding)
export function useAvailableTeamMembers(teamId: string | null, boardId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["available-team-members", teamId, boardId],
    queryFn: async () => {
      if (!teamId || !boardId) return [];

      // Get team members with their profiles and role
      const { data: teamMembers, error: teamError } = await supabase
        .from("team_members")
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            job_title
          )
        `)
        .eq("team_id", teamId);

      if (teamError) throw teamError;

      // Get board members
      const { data: boardMembers, error: boardError } = await supabase
        .from("board_members")
        .select("user_id")
        .eq("board_id", boardId);

      if (boardError) throw boardError;

      const boardMemberIds = new Set(boardMembers?.map((m) => m.user_id) || []);

      // Filter out users already in board
      return teamMembers
        .filter((tm: any) => !boardMemberIds.has(tm.user_id))
        .map((tm: any) => ({
          user_id: tm.user_id,
          full_name: tm.profiles?.full_name || "Usuário",
          avatar_url: tm.profiles?.avatar_url || null,
          job_title: tm.profiles?.job_title || null,
          team_role: tm.role === "admin" ? "owner" : "member",
        }))
        .sort((a: any, b: any) => (a.full_name as string).localeCompare(b.full_name as string));
    },
    enabled: !!user && !!teamId && !!boardId,
  });
}
