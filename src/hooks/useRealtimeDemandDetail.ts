import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { mergeDemandRowIntoCache } from "@/lib/demandRealtimeCache";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";

interface RealtimeUpdate {
  type: "demand" | "interaction" | "assignee" | "subtask";
  eventType: string;
  timestamp: Date;
}

export function useRealtimeDemandDetail(demandId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const [showUpdateIndicator, setShowUpdateIndicator] = useState(false);

  const clearUpdateIndicator = useCallback(() => {
    setShowUpdateIndicator(false);
    setLastUpdate(null);
  }, []);

  const instanceId = useRef(createRealtimeInstanceId());

  useEffect(() => {
    if (!user || !demandId) return;

    const channel = supabase
      .channel(`demand-detail-${demandId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demands',
        },
        (payload) => {
          const next = payload.new as Record<string, any> | null;
          const previous = payload.old as Record<string, any> | null;
          const touchedIds = [next?.id, next?.parent_demand_id, previous?.id, previous?.parent_demand_id].filter(Boolean) as string[];

          if (next?.id) {
            mergeDemandRowIntoCache(queryClient, next as any);
          }

          touchedIds.forEach((id) => {
            queryClient.invalidateQueries({ queryKey: ["demand", id] });
            queryClient.invalidateQueries({ queryKey: ["subdemands", id] });
            queryClient.invalidateQueries({ queryKey: ["parent-aggregated-time", id] });
          });

          queryClient.invalidateQueries({ queryKey: ["demands"] });
          queryClient.invalidateQueries({ queryKey: ["all-team-demands"] });
          queryClient.invalidateQueries({ queryKey: ["subdemands-time-entries"] });
          queryClient.invalidateQueries({ queryKey: ["kanban-parent-time"] });
          queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });

          setLastUpdate({ type: "demand", eventType: payload.eventType, timestamp: new Date() });
          setShowUpdateIndicator(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demand_interactions',
          filter: `demand_id=eq.${demandId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["demand-interactions", demandId] });
          setLastUpdate({ type: "interaction", eventType: payload.eventType, timestamp: new Date() });
          setShowUpdateIndicator(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demand_assignees',
          filter: `demand_id=eq.${demandId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["demand-assignees", demandId] });
          setLastUpdate({ type: "assignee", eventType: payload.eventType, timestamp: new Date() });
          setShowUpdateIndicator(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demand_subtasks',
          filter: `demand_id=eq.${demandId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["demand-subtasks", demandId] });
          setLastUpdate({ type: "subtask", eventType: payload.eventType, timestamp: new Date() });
          setShowUpdateIndicator(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, demandId, queryClient]);

  useEffect(() => {
    if (showUpdateIndicator) {
      const timer = setTimeout(() => {
        setShowUpdateIndicator(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showUpdateIndicator]);

  return { lastUpdate, showUpdateIndicator, clearUpdateIndicator };
}
