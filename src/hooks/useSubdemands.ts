import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlansModal } from "@/contexts/PlansModalContext";
import { showPlanLimitToast } from "@/lib/planLimitErrors";

export interface Subdemand {
  id: string;
  title: string;
  status_id: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  parent_demand_id: string;
  board_sequence_number: number | null;
  time_in_progress_seconds: number | null;
  subdemand_sort_order: number | null;
  demand_statuses: { name: string; color: string } | null;
  demand_assignees?: { user_id: string; profile: { full_name: string; avatar_url: string | null } }[];
}

export function useSubdemands(parentDemandId: string | null) {
  return useQuery({
    queryKey: ["subdemands", parentDemandId],
    queryFn: async () => {
      if (!parentDemandId) return [];
      const { data, error } = await supabase
        .from("demands")
        .select(`
          id, title, status_id, priority, due_date, created_at, parent_demand_id, board_sequence_number, time_in_progress_seconds, subdemand_sort_order,
          demand_statuses(name, color),
          demand_assignees(user_id, profile:profiles(full_name, avatar_url))
        `)
        .eq("parent_demand_id", parentDemandId)
        .eq("archived", false)
        .order("subdemand_sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Subdemand[];
    },
    enabled: !!parentDemandId,
  });
}

export function useReorderSubdemands() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentDemandId, orderedIds }: { parentDemandId: string; orderedIds: string[] }) => {
      const { error } = await supabase.rpc("reorder_subdemands", {
        p_parent_id: parentDemandId,
        p_ordered_ids: orderedIds,
      });
      if (error) throw error;
    },
    onMutate: async ({ parentDemandId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["subdemands", parentDemandId] });
      const previous = queryClient.getQueryData<Subdemand[]>(["subdemands", parentDemandId]);
      if (previous) {
        const map = new Map(previous.map((s) => [s.id, s]));
        const reordered = orderedIds
          .map((id, idx) => {
            const s = map.get(id);
            return s ? { ...s, subdemand_sort_order: idx + 1 } : null;
          })
          .filter(Boolean) as Subdemand[];
        queryClient.setQueryData(["subdemands", parentDemandId], reordered);
      }
      return { previous };
    },
    onError: (_err, { parentDemandId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["subdemands", parentDemandId], context.previous);
      }
    },
    onSettled: (_data, _err, { parentDemandId }) => {
      queryClient.invalidateQueries({ queryKey: ["subdemands", parentDemandId] });
    },
  });
}

export function useDemandDependencies(demandId: string | null) {
  return useQuery({
    queryKey: ["demand-dependencies", demandId],
    queryFn: async () => {
      if (!demandId) return [];
      const { data, error } = await supabase
        .from("demand_dependencies")
        .select(`
          id, demand_id, depends_on_demand_id,
          depends_on:demands!demand_dependencies_depends_on_demand_id_fkey(id, title, status_id, demand_statuses(name, color))
        `)
        .eq("demand_id", demandId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!demandId,
  });
}

export interface SubdemandInput {
  title: string;
  description?: string;
  priority?: string;
  service_id?: string;
  assigned_to?: string;
  due_date?: string;
  status_id?: string;
}

export interface DependencyInput {
  demand_index: number; // 1-based
  depends_on_index: number; // 1-based
}

export function useCreateDemandWithSubdemands() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { openPlans } = usePlansModal();

  return useMutation({
    mutationFn: async ({
      parent,
      subdemands,
      dependencies,
    }: {
      parent: {
        title: string;
        description?: string;
        team_id: string;
        board_id: string;
        status_id: string;
        priority?: string;
        assigned_to?: string;
        due_date?: string;
        service_id?: string;
      };
      subdemands: SubdemandInput[];
      dependencies: DependencyInput[];
    }) => {
      // Build subdemands with same status_id as parent if not specified
      const subs = subdemands.map((s) => ({
        title: s.title,
        description: s.description || null,
        priority: s.priority || "média",
        service_id: s.service_id || null,
        assigned_to: s.assigned_to || null,
        due_date: s.due_date || null,
        status_id: s.status_id || parent.status_id,
      }));

      const { data, error } = await supabase.rpc("create_demand_with_subdemands", {
        p_parent: parent as any,
        p_subdemands: subs as any,
        p_dependencies: dependencies as any,
      });

      if (error) throw error;
      return data as { parent_id: string; subdemand_ids: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["subdemands"] });
    },
    onError: (error: Error) => {
      showPlanLimitToast(error, openPlans);
    },
  });
}

/**
 * Update (set, change or remove) the dependency of a subdemand.
 * Strategy: delete all existing dependencies for the demand_id, then insert the new one (if any).
 */
export function useUpdateSubdemandDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demandId,
      dependsOnDemandId,
    }: {
      demandId: string;
      dependsOnDemandId: string | null;
    }) => {
      // Always clear existing dependencies for this demand first
      const { error: deleteError } = await supabase
        .from("demand_dependencies")
        .delete()
        .eq("demand_id", demandId);
      if (deleteError) throw deleteError;

      if (dependsOnDemandId) {
        const { error: insertError } = await supabase
          .from("demand_dependencies")
          .insert({ demand_id: demandId, depends_on_demand_id: dependsOnDemandId });
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subdemands"] });
      queryClient.invalidateQueries({ queryKey: ["demand-dependencies"] });
      queryClient.invalidateQueries({ queryKey: ["batch-dependency-info"] });
      queryClient.invalidateQueries({ queryKey: ["demand-dependency-info", variables.demandId] });
    },
  });
}

export function useAddSubdemand() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      parentDemandId,
      title,
      teamId,
      boardId,
      statusId,
      priority,
      description,
      dueDate,
      serviceId,
    }: {
      parentDemandId: string;
      title: string;
      teamId: string;
      boardId: string;
      statusId: string;
      priority?: string;
      description?: string;
      dueDate?: string;
      serviceId?: string;
    }) => {
      const { data, error } = await supabase
        .from("demands")
        .insert({
          title,
          team_id: teamId,
          board_id: boardId,
          status_id: statusId,
          priority: priority || "média",
          parent_demand_id: parentDemandId,
          created_by: user!.id,
          description: description || null,
          due_date: dueDate || null,
          service_id: serviceId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subdemands", variables.parentDemandId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
  });
}

/**
 * Convert an existing demand into a subdemand of another demand (same board).
 * Pass parentDemandId = null to detach (make it a top-level demand again).
 */
export function useConvertToSubdemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demandId,
      parentDemandId,
      boardId,
    }: {
      demandId: string;
      parentDemandId: string | null;
      boardId: string;
    }) => {
      if (parentDemandId) {
        if (parentDemandId === demandId) {
          throw new Error("Uma demanda não pode ser subdemanda dela mesma.");
        }

        // Validate parent: must exist in same board, be top-level, not archived
        const { data: parent, error: parentErr } = await supabase
          .from("demands")
          .select("id, board_id, parent_demand_id, archived")
          .eq("id", parentDemandId)
          .single();
        if (parentErr) throw parentErr;
        if (!parent || parent.archived) {
          throw new Error("Demanda pai inválida.");
        }
        if (parent.board_id !== boardId) {
          throw new Error("A demanda pai precisa estar no mesmo quadro.");
        }
        if (parent.parent_demand_id) {
          throw new Error("Não é possível aninhar subdemandas em outra subdemanda.");
        }

        // Child must not have subdemands
        const { count, error: countErr } = await supabase
          .from("demands")
          .select("id", { count: "exact", head: true })
          .eq("parent_demand_id", demandId)
          .eq("archived", false);
        if (countErr) throw countErr;
        if ((count ?? 0) > 0) {
          throw new Error("Esta demanda possui subdemandas e não pode se tornar uma subdemanda.");
        }
      }

      const { error } = await supabase
        .from("demands")
        .update({ parent_demand_id: parentDemandId })
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demand", variables.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand-parent"] });
      queryClient.invalidateQueries({ queryKey: ["subdemands"] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["demands-list", variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-columns"] });
      queryClient.invalidateQueries({ queryKey: ["all-boards-kanban-columns"] });
    },
  });
}
