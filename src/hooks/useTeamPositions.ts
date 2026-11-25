// Performances: grupos de membros internos da equipe (substituem os antigos cargos).
// Nomes "Position" mantidos por compatibilidade com os componentes existentes.
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
  member_count?: number;
}
export type TeamPerformance = TeamPosition;

const dupMsg = "Já existe uma performance com este nome nesta equipe";

export function friendlyPerformanceError(e: any): string {
  const m = String(e?.message ?? "");
  if (m.includes("PERFORMANCE_MEMBER_NOT_INTERNAL")) return "Só membros internos podem fazer parte de uma performance";
  if (m.includes("PERFORMANCE_MEMBER_IS_OWNER")) return "O dono da equipe não faz parte de performances";
  if (m.includes("PERFORMANCE_MEMBER_OTHER_TEAM")) return "Essa pessoa não é desta equipe";
  if (e?.code === "23505") return dupMsg;
  return m || "Erro ao salvar performance";
}

export function useTeamPositions(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ["team-performances", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from("team_performances")
        .select("*, team_performance_members(count)")
        .eq("team_id", teamId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        member_count: p.team_performance_members?.[0]?.count ?? 0,
      })) as TeamPosition[];
    },
    enabled: !!teamId,
  });
}
export const useTeamPerformances = useTeamPositions;

function invalidate(qc: ReturnType<typeof useQueryClient>, teamId?: string) {
  qc.invalidateQueries({ queryKey: ["team-performances", teamId] });
  qc.invalidateQueries({ queryKey: ["performance-members"] });
  qc.invalidateQueries({ queryKey: ["members-by-position"] });
  qc.invalidateQueries({ queryKey: ["team-members"] });
}

type Fields = { name: string; description?: string; color: string; textColor?: string };

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, name, description, color, textColor }: Fields & { teamId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("team_performances")
        .insert({ team_id: teamId, name: name.trim(), description: description?.trim() || null, color, text_color: textColor || "auto", created_by: user.id })
        .select()
        .maybeSingle();
      if (error) throw new Error(friendlyPerformanceError(error));
      return data;
    },
    onSuccess: (_, v) => invalidate(qc, v.teamId),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ positionId, name, description, color, textColor }: Fields & { positionId: string; teamId: string }) => {
      const { data, error } = await supabase
        .from("team_performances")
        .update({ name: name.trim(), description: description?.trim() || null, color, text_color: textColor || "auto" })
        .eq("id", positionId)
        .select()
        .maybeSingle();
      if (error) throw new Error(friendlyPerformanceError(error));
      return data;
    },
    onSuccess: (_, v) => invalidate(qc, v.teamId),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ positionId }: { positionId: string; teamId: string }) => {
      const { error } = await supabase.from("team_performances").delete().eq("id", positionId);
      if (error) throw error;
    },
    onSuccess: (_, v) => invalidate(qc, v.teamId),
  });
}

/** IDs de membros (team_members.id) de uma performance. */
export function usePerformanceMembers(performanceId: string | null | undefined) {
  return useQuery({
    queryKey: ["performance-members", performanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_performance_members")
        .select("team_member_id")
        .eq("performance_id", performanceId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.team_member_id);
    },
    enabled: !!performanceId,
  });
}

export function useTogglePerformanceMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ performanceId, memberId, add }: { performanceId: string; memberId: string; add: boolean; teamId: string }) => {
      if (add) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("team_performance_members")
          .insert({ performance_id: performanceId, team_member_id: memberId, added_by: user?.id ?? null });
        if (error && error.code !== "23505") throw new Error(friendlyPerformanceError(error));
      } else {
        const { error } = await supabase
          .from("team_performance_members")
          .delete()
          .eq("performance_id", performanceId)
          .eq("team_member_id", memberId);
        if (error) throw error;
      }
    },
    // Seleção otimista: marca/desmarca na hora e confirma em segundo plano.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["team-members", v.teamId] });
      await qc.cancelQueries({ queryKey: ["team-performances", v.teamId] });
      const prevMembers = qc.getQueryData<any[]>(["team-members", v.teamId]);
      const prevPerfs = qc.getQueryData<TeamPosition[]>(["team-performances", v.teamId]);
      const perf = prevPerfs?.find((p) => p.id === v.performanceId);

      if (prevMembers) {
        qc.setQueryData(["team-members", v.teamId], prevMembers.map((m: any) => {
          if (m.id !== v.memberId) return m;
          const list: any[] = m.performances ?? [];
          const has = list.some((p) => p.id === v.performanceId);
          if (v.add && !has && perf) {
            return {
              ...m,
              performances: [...list, { id: perf.id, name: perf.name, color: perf.color, text_color: perf.text_color }]
                .sort((a, b) => a.name.localeCompare(b.name)),
            };
          }
          if (!v.add && has) {
            return { ...m, performances: list.filter((p) => p.id !== v.performanceId) };
          }
          return m;
        }));
      }
      if (prevPerfs) {
        qc.setQueryData(["team-performances", v.teamId], prevPerfs.map((p) =>
          p.id === v.performanceId
            ? { ...p, member_count: Math.max(0, (p.member_count ?? 0) + (v.add ? 1 : -1)) }
            : p,
        ));
      }
      return { prevMembers, prevPerfs };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prevMembers) qc.setQueryData(["team-members", v.teamId], ctx.prevMembers);
      if (ctx?.prevPerfs) qc.setQueryData(["team-performances", v.teamId], ctx.prevPerfs);
    },
    onSettled: (_, __, v) => invalidate(qc, v.teamId),
  });
}
