import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDemands, useDemandStatuses } from "./useDemands";
import { supabase } from "@/integrations/supabase/client";

export function useAdjustmentCount(teamId: string | null) {
  const { data: demands } = useDemands(teamId || undefined);
  const { data: statuses } = useDemandStatuses();

  const count = useMemo(() => {
    if (!demands || !statuses) return 0;
    const adjustmentStatusId = statuses.find((s) => s.name === "Em Ajuste")?.id;
    if (!adjustmentStatusId) return 0;
    return demands.filter(
      (d) => d.status_id === adjustmentStatusId && !d.archived
    ).length;
  }, [demands, statuses]);

  return count;
}

export interface AdjustmentInfo {
  count: number;
  latestType: "internal" | "external" | null;
}

export function useAdjustmentCounts(demandIds: string[]) {
  return useQuery({
    queryKey: ["adjustment-counts", demandIds],
    queryFn: async () => {
      if (demandIds.length === 0) return {};

      const { data, error } = await supabase
        .from("demand_interactions")
        .select("demand_id, metadata, created_at")
        .in("demand_id", demandIds)
        .eq("interaction_type", "adjustment_request")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const info: Record<string, AdjustmentInfo> = {};
      data?.forEach((item) => {
        if (!info[item.demand_id]) {
          // First occurrence is the latest (ordered desc)
          const metadata = item.metadata as { adjustment_type?: string } | null;
          info[item.demand_id] = {
            count: 1,
            latestType: (metadata?.adjustment_type as "internal" | "external") || null,
          };
        } else {
          info[item.demand_id].count += 1;
        }
      });

      return info;
    },
    enabled: demandIds.length > 0,
  });
}
