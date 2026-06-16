import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { mergeDemandRowIntoCache } from "@/lib/demandRealtimeCache";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";

export interface KanbanMoveNotification {
  demandId: string;
  demandTitle: string;
  fromStatus: string;
  toStatus: string;
  movedBy: string;
  timestamp: Date;
}

export function useRealtimeDemands(boardId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useRef(createRealtimeInstanceId());

  useEffect(() => {
    if (!user || !boardId) return;

    const channel = supabase
      .channel(`demands-board-${boardId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demands',
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, any> | null;
          const previous = payload.old as Record<string, any> | null;
          const touchedIds = [next?.id, next?.parent_demand_id, previous?.id, previous?.parent_demand_id].filter(Boolean) as string[];

          if (next?.id) {
            mergeDemandRowIntoCache(queryClient, next as any);
          }

          queryClient.invalidateQueries({ queryKey: ["demands", boardId] });
          queryClient.invalidateQueries({ queryKey: ["demands-list", boardId] });
          queryClient.invalidateQueries({ queryKey: ["demands"] });
          queryClient.invalidateQueries({ queryKey: ["all-team-demands"] });
          queryClient.invalidateQueries({ queryKey: ["subdemands"] });
          queryClient.invalidateQueries({ queryKey: ["batch-dependency-info"] });
          queryClient.invalidateQueries({ queryKey: ["demand-dependency-info"] });
          queryClient.invalidateQueries({ queryKey: ["subdemands-time-entries"] });
          queryClient.invalidateQueries({ queryKey: ["kanban-parent-time"] });
          queryClient.invalidateQueries({ queryKey: ["kanban-parent-subdemand-ids"] });
          queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });

          touchedIds.forEach((id) => {
            queryClient.invalidateQueries({ queryKey: ["demand", id] });
            queryClient.invalidateQueries({ queryKey: ["subdemands", id] });
            queryClient.invalidateQueries({ queryKey: ["parent-aggregated-time", id] });
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demand_time_entries',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["subdemands-time-entries"] });
          queryClient.invalidateQueries({ queryKey: ["kanban-parent-time"] });
          queryClient.invalidateQueries({ queryKey: ["board-time-entries"] });
          queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
          queryClient.invalidateQueries({ queryKey: ["parent-aggregated-time"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, boardId, queryClient]);
}

export function useRealtimeAllDemands() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const instanceId = useRef(createRealtimeInstanceId());

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`demands-all-${instanceId.current}`)
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

          queryClient.invalidateQueries({ queryKey: ["demands"] });
          queryClient.invalidateQueries({ queryKey: ["demands-list"] });
          queryClient.invalidateQueries({ queryKey: ["all-team-demands"] });
          queryClient.invalidateQueries({ queryKey: ["subdemands"] });
          queryClient.invalidateQueries({ queryKey: ["batch-dependency-info"] });
          queryClient.invalidateQueries({ queryKey: ["demand-dependency-info"] });
          queryClient.invalidateQueries({ queryKey: ["subdemands-time-entries"] });
          queryClient.invalidateQueries({ queryKey: ["kanban-parent-time"] });
          queryClient.invalidateQueries({ queryKey: ["kanban-parent-subdemand-ids"] });
          queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });

          touchedIds.forEach((id) => {
            queryClient.invalidateQueries({ queryKey: ["demand", id] });
            queryClient.invalidateQueries({ queryKey: ["subdemands", id] });
            queryClient.invalidateQueries({ queryKey: ["parent-aggregated-time", id] });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}

export function useKanbanRealtimeNotifications(boardId?: string) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<KanbanMoveNotification[]>([]);

  const clearNotification = useCallback((demandId: string) => {
    setNotifications(prev => prev.filter(n => n.demandId !== demandId));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const instanceId = useRef(createRealtimeInstanceId());

  useEffect(() => {
    if (!user || !boardId) return;

    const channel = supabase
      .channel(`kanban-notifications-${boardId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'demands',
          filter: `board_id=eq.${boardId}`,
        },
        async (payload) => {
          const oldData = payload.old as any;
          const newData = payload.new as any;

          if (oldData.status_id !== newData.status_id) {
            const [oldStatusRes, newStatusRes, demandRes] = await Promise.all([
              supabase.from('demand_statuses').select('name').eq('id', oldData.status_id).single(),
              supabase.from('demand_statuses').select('name').eq('id', newData.status_id).single(),
              supabase.from('demands').select('title, created_by').eq('id', newData.id).single()
            ]);

            if (oldStatusRes.data && newStatusRes.data && demandRes.data) {
              const notification: KanbanMoveNotification = {
                demandId: newData.id,
                demandTitle: demandRes.data.title,
                fromStatus: oldStatusRes.data.name,
                toStatus: newStatusRes.data.name,
                movedBy: demandRes.data.created_by || 'Usuário',
                timestamp: new Date()
              };

              setNotifications(prev => {
                const filtered = prev.filter(n => n.demandId !== notification.demandId);
                return [...filtered, notification];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, boardId]);

  useEffect(() => {
    if (notifications.length === 0) return;

    const timer = setTimeout(() => {
      setNotifications(prev => {
        if (prev.length === 0) return prev;
        return prev.slice(1);
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [notifications]);

  return {
    notifications,
    clearNotification,
    clearAllNotifications,
    hasNotifications: notifications.length > 0
  };
}

