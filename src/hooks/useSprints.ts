import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { SprintStatus } from "@/lib/sprints";

export interface Sprint {
  id: string;
  board_id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  completed_at: string | null;
  created_at: string;
}

export interface SprintMembership {
  sprint_id: string;
  demand_id: string;
  sprint_status: SprintStatus;
}

export function useSprints(boardId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sprints", boardId, user?.id],
    enabled: !!boardId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_sprints")
        .select("*")
        .eq("board_id", boardId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sprint[];
    },
  });
}

/** Todas as associações demanda↔sprint do quadro. */
export function useSprintMemberships(boardId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sprint-memberships", boardId, user?.id],
    enabled: !!boardId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_demands")
        .select("sprint_id, demand_id, board_sprints!inner(status, board_id)")
        .eq("board_sprints.board_id", boardId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        sprint_id: r.sprint_id,
        demand_id: r.demand_id,
        sprint_status: r.board_sprints.status,
      })) as SprintMembership[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["sprints"] });
    qc.invalidateQueries({ queryKey: ["sprint-memberships"] });
    qc.invalidateQueries({ queryKey: ["demand-sprint"] });
  };
}

export function useSaveSprint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (s: Partial<Sprint> & { board_id: string }) => {
      const payload = {
        board_id: s.board_id,
        name: s.name!,
        goal: s.goal ?? null,
        start_date: s.start_date!,
        end_date: s.end_date!,
        ...(s.status ? { status: s.status } : {}),
      };
      const q = s.id
        ? supabase.from("board_sprints").update(payload).eq("id", s.id)
        : supabase.from("board_sprints").insert(payload);
      const { error } = await q;
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma sprint ativa neste quadro. Conclua-a antes.");
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSprint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("board_sprints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddDemandsToSprint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ sprintId, demandIds }: { sprintId: string; demandIds: string[] }) => {
      if (!demandIds.length) return;
      const { error } = await supabase
        .from("sprint_demands")
        .insert(demandIds.map((demand_id) => ({ sprint_id: sprintId, demand_id })));
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveDemandFromSprint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ sprintId, demandId }: { sprintId: string; demandId: string }) => {
      const { error } = await supabase
        .from("sprint_demands")
        .delete()
        .eq("sprint_id", sprintId)
        .eq("demand_id", demandId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteSprint() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ sprintId, carryTo }: { sprintId: string; carryTo: string | null }) => {
      const { data, error } = await supabase.rpc("complete_sprint", {
        _sprint_id: sprintId,
        _carry_to: carryTo ?? undefined,
      } as any);
      if (error) throw error;
      return data as number;
    },
    onSuccess: invalidate,
  });
}

/** Sprint em aberto (planejada ou ativa) de uma demanda. */
export function useDemandSprint(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-sprint", demandId],
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_demands")
        .select("board_sprints!inner(id, name, status)")
        .eq("demand_id", demandId!)
        .neq("board_sprints.status", "completed")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.board_sprints ?? null) as { id: string; name: string; status: SprintStatus } | null;
    },
  });
}
