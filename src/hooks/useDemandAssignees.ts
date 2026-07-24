import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  notifyDemandAssigneeChange,
  type DemandAssigneeEvent,
} from "@/lib/demandAssigneeNotifications";

interface DemandContext {
  demandTitle: string;
  boardName?: string;
}

async function loadDemandContext(demandId: string): Promise<DemandContext> {
  const { data } = await supabase
    .from("demands")
    .select("title, boards(name)")
    .eq("id", demandId)
    .maybeSingle();
  const boardName = (data as { boards?: { name?: string } } | null)?.boards?.name;
  return {
    demandTitle: (data as { title?: string } | null)?.title ?? "",
    boardName: boardName ?? undefined,
  };
}

async function loadActor(): Promise<{ id: string; name: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    name: (profile as { full_name?: string } | null)?.full_name || "Alguém",
  };
}

async function dispatchAssigneeNotifications(
  demandId: string,
  events: Array<{ userId: string; event: DemandAssigneeEvent }>
) {
  if (events.length === 0) return;
  try {
    const [ctx, actor] = await Promise.all([
      loadDemandContext(demandId),
      loadActor(),
    ]);
    if (!actor) return;
    await Promise.allSettled(
      events.map(({ userId, event }) =>
        notifyDemandAssigneeChange({
          event,
          userId,
          demandId,
          demandTitle: ctx.demandTitle,
          boardName: ctx.boardName,
          actorId: actor.id,
          actorName: actor.name,
        })
      )
    );
  } catch (err) {
    console.warn("[useDemandAssignees] dispatch notifications failed:", err);
  }
}

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
        .select("is_primary")
        .maybeSingle();

      if (error) throw error;
      return { demandId, userId, isPrimary: !!(data as { is_primary?: boolean })?.is_primary };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand-assignees", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      void dispatchAssigneeNotifications(result.demandId, [
        {
          userId: result.userId,
          event: result.isPrimary ? "assigned_primary" : "assigned_follower",
        },
      ]);
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
      return { demandId, userId };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand-assignees", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      void dispatchAssigneeNotifications(result.demandId, [
        { userId: result.userId, event: "unassigned" },
      ]);
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

      // Build notification events
      const events: Array<{ userId: string; event: DemandAssigneeEvent }> = [];
      for (const uid of toAdd) {
        events.push({
          userId: uid,
          event: uid === resolvedPrimary ? "assigned_primary" : "assigned_follower",
        });
      }
      for (const uid of toRemove) {
        events.push({ userId: uid, event: "unassigned" });
      }
      // Existing assignee promoted to primary (wasn't newly added)
      if (
        resolvedPrimary &&
        currentPrimary !== resolvedPrimary &&
        !toAdd.includes(resolvedPrimary) &&
        currentUserIds.includes(resolvedPrimary)
      ) {
        events.push({ userId: resolvedPrimary, event: "promoted_primary" });
      }

      return { demandId, events };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand-assignees", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      if (result?.events?.length) {
        void dispatchAssigneeNotifications(result.demandId, result.events);
      }
    },
  });
}
