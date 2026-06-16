import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Assignee {
  id: string;
  user_id: string;
  assigned_at: string;
  is_primary: boolean;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

export function useDemandAssignees(demandId: string | null) {
  return useQuery({
    queryKey: ["demand-assignees", demandId],
    queryFn: async () => {
      if (!demandId) return [];

      const { data, error } = await supabase
        .from("demand_assignees")
        .select(`
          id,
          user_id,
          assigned_at,
          is_primary,
          profile:profiles(full_name, avatar_url)
        `)
        .eq("demand_id", demandId);

      if (error) throw error;
      return data as unknown as Assignee[];
    },
    enabled: !!demandId,
  });
}

export function useAddAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, userId }: { demandId: string; userId: string }) => {
      const { data, error } = await supabase
        .from("demand_assignees")
        .insert({
          demand_id: demandId,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand-assignees", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
  });
}

export function useRemoveAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, userId }: { demandId: string; userId: string }) => {
      const { error } = await supabase
        .from("demand_assignees")
        .delete()
        .eq("demand_id", demandId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand-assignees", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
  });
}

export function useSetAssignees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demandId,
      userIds,
      primaryUserId,
    }: {
      demandId: string;
      userIds: string[];
      primaryUserId?: string | null;
    }) => {
      // Guard: a demand must always have at least one responsible
      if (!userIds || userIds.length === 0) {
        throw new Error("A demanda precisa ter ao menos um responsável.");
      }

      // Resolve the primary user. Must be inside userIds; falls back to first.
      const resolvedPrimary =
        primaryUserId && userIds.includes(primaryUserId)
          ? primaryUserId
          : userIds[0];

      // Get current assignees (incl. is_primary flag)
      const { data: currentAssignees, error: fetchError } = await supabase
        .from("demand_assignees")
        .select("user_id, is_primary")
        .eq("demand_id", demandId);

      if (fetchError) throw fetchError;

      const currentUserIds = (currentAssignees ?? []).map((a) => a.user_id);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentActorId = user?.id ?? null;

      const toRemove = currentUserIds.filter((id) => !userIds.includes(id));
      const toAdd = userIds.filter((id) => !currentUserIds.includes(id));

      // Add new assignees first so a current assignee does not lose
      // permission mid-operation when replacing the assignee list.
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("demand_assignees")
          .upsert(
            toAdd.map((userId) => ({
              demand_id: demandId,
              user_id: userId,
              is_primary: false,
            })),
            { onConflict: "demand_id,user_id", ignoreDuplicates: true }
          );

        if (insertError) {
          const msg = (insertError as any)?.message || "";
          if (msg.includes("row-level security")) {
            throw new Error(
              "Você não tem permissão para alterar os responsáveis desta demanda."
            );
          }
          throw insertError;
        }
      }

      // Remove assignees that are no longer selected.
      if (toRemove.length > 0) {
        const otherUsersToRemove = currentActorId
          ? toRemove.filter((id) => id !== currentActorId)
          : toRemove;
        const shouldRemoveSelfLast =
          !!currentActorId && toRemove.includes(currentActorId);

        if (otherUsersToRemove.length > 0) {
          const { error: deleteOthersError } = await supabase
            .from("demand_assignees")
            .delete()
            .eq("demand_id", demandId)
            .in("user_id", otherUsersToRemove);

          if (deleteOthersError) throw deleteOthersError;
        }

        if (shouldRemoveSelfLast && currentActorId) {
          const { error: deleteSelfError } = await supabase
            .from("demand_assignees")
            .delete()
            .eq("demand_id", demandId)
            .eq("user_id", currentActorId);

          if (deleteSelfError) throw deleteSelfError;
        }
      }

      // ---- Update is_primary flag ----
      // Strategy to respect the partial unique index (one primary per demand):
      //   1) Demote the current primary (if it differs from resolved one).
      //   2) Promote the new primary.
      // Check current primary
      const currentPrimary = (currentAssignees ?? []).find((a) => a.is_primary)
        ?.user_id;

      if (currentPrimary && currentPrimary !== resolvedPrimary) {
        // Only demote if it still exists after deletions
        const stillExists = userIds.includes(currentPrimary);
        if (stillExists) {
          const { error: demoteErr } = await supabase
            .from("demand_assignees")
            .update({ is_primary: false })
            .eq("demand_id", demandId)
            .eq("user_id", currentPrimary);
          if (demoteErr) throw demoteErr;
        }
      }

      if (currentPrimary !== resolvedPrimary) {
        const { error: promoteErr } = await supabase
          .from("demand_assignees")
          .update({ is_primary: true })
          .eq("demand_id", demandId)
          .eq("user_id", resolvedPrimary);
        if (promoteErr) throw promoteErr;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand-assignees", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
  });
}
