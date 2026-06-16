import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface DependencyInfo {
  dependsOnDemandId: string;
  dependsOnTitle: string;
  dependsOnStatusName: string;
  isBlocked: boolean;
}

/**
 * Fetches dependency info for a single demand.
 * Returns the list of demands this one depends on and whether it's blocked.
 */
export function useDemandDependencyInfo(demandId: string | null) {
  return useQuery({
    queryKey: ["demand-dependency-info", demandId],
    queryFn: async (): Promise<DependencyInfo[]> => {
      if (!demandId) return [];
      const { data, error } = await supabase
        .from("demand_dependencies")
        .select(`
          depends_on_demand_id,
          depends_on:demands!demand_dependencies_depends_on_demand_id_fkey(
            id, title, status_id,
            demand_statuses(name, color)
          )
        `)
        .eq("demand_id", demandId);
      if (error) throw error;
      if (!data) return [];

      return data.map((dep: any) => {
        const statusName = dep.depends_on?.demand_statuses?.name || "";
        return {
          dependsOnDemandId: dep.depends_on_demand_id,
          dependsOnTitle: dep.depends_on?.title || "Desconhecida",
          dependsOnStatusName: statusName,
          isBlocked: statusName !== "Entregue",
        };
      });
    },
    enabled: !!demandId,
  });
}

/**
 * Batch fetch dependency info for multiple demand IDs.
 * Returns a map of demandId -> DependencyInfo[]
 */
export function useBatchDependencyInfo(demandIds: string[]) {
  return useQuery({
    queryKey: ["batch-dependency-info", demandIds.sort().join(",")],
    queryFn: async (): Promise<Record<string, DependencyInfo[]>> => {
      if (demandIds.length === 0) return {};
      const { data, error } = await supabase
        .from("demand_dependencies")
        .select(`
          demand_id,
          depends_on_demand_id,
          depends_on:demands!demand_dependencies_depends_on_demand_id_fkey(
            id, title, status_id,
            demand_statuses(name, color)
          )
        `)
        .in("demand_id", demandIds);
      if (error) throw error;
      if (!data) return {};

      const result: Record<string, DependencyInfo[]> = {};
      for (const dep of data as any[]) {
        const statusName = dep.depends_on?.demand_statuses?.name || "";
        const info: DependencyInfo = {
          dependsOnDemandId: dep.depends_on_demand_id,
          dependsOnTitle: dep.depends_on?.title || "Desconhecida",
          dependsOnStatusName: statusName,
          isBlocked: statusName !== "Entregue",
        };
        if (!result[dep.demand_id]) result[dep.demand_id] = [];
        result[dep.demand_id].push(info);
      }
      return result;
    },
    enabled: demandIds.length > 0,
  });
}

/**
 * Check dependencies for a demand before allowing status change.
 * Returns { blocked: true, reason: "..." } if blocked, or { blocked: false }.
 */
export async function checkDependencyBeforeStatusChange(
  demandId: string
): Promise<{ blocked: boolean; blockedByTitle?: string }> {
  const { data, error } = await supabase
    .from("demand_dependencies")
    .select(`
      depends_on_demand_id,
      depends_on:demands!demand_dependencies_depends_on_demand_id_fkey(
        id, title, status_id,
        demand_statuses(name)
      )
    `)
    .eq("demand_id", demandId);

  if (error || !data) return { blocked: false };

  for (const dep of data as any[]) {
    const statusName = dep.depends_on?.demand_statuses?.name || "";
    if (statusName !== "Entregue") {
      return {
        blocked: true,
        blockedByTitle: dep.depends_on?.title || "Desconhecida",
      };
    }
  }
  return { blocked: false };
}
