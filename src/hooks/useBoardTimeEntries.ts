import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";

export interface BoardTimeEntry {
  id: string;
  demand_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
  demand: {
    id: string;
    title: string;
    board_id: string;
    status_id: string;
    priority: string | null;
    status: {
      name: string;
      color: string;
    };
  };
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export type BoardMemberRole = "admin" | "moderator" | "executor" | "requester";

export interface BoardUserTimeStats {
  userId: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  role?: BoardMemberRole;
  totalSeconds: number;
  isActive: boolean;
  activeStartedAt: string | null;
  demandCount: number;
  deliveredCount: number;
  inProgressCount: number;
  entries: BoardTimeEntry[];
}

export interface BoardMemberWithTime {
  userId: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  role: BoardMemberRole;
  totalSeconds: number;
  isActive: boolean;
  activeStartedAt: string | null;
  demandCount: number;
  deliveredCount: number;
  inProgressCount: number;
  entries: BoardTimeEntry[];
}

export function useBoardTimeEntries(boardId: string | null) {
  const queryClient = useQueryClient();
  const instanceId = useRef(createRealtimeInstanceId());

  const query = useQuery({
    queryKey: ["board-time-entries", boardId],
    queryFn: async () => {
      if (!boardId) return [];

      // Fetch time entries with demands filtered by board_id
      const { data: entries, error: entriesError } = await supabase
        .from("demand_time_entries")
        .select(`
          *,
          demand:demands!inner(
            id,
            title,
            board_id,
            status_id,
            priority,
            status:demand_statuses(name, color)
          )
        `)
        .eq("demand.board_id", boardId)
        .order("started_at", { ascending: false });

      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) return [];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(entries.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Combine entries with profiles
      return entries.map(entry => ({
        ...entry,
        profile: profileMap.get(entry.user_id) || { id: entry.user_id, full_name: "Usuário", avatar_url: null },
      })) as BoardTimeEntry[];
    },
    enabled: !!boardId,
    refetchInterval: false,
  });

  // Subscribe to realtime updates for demand_time_entries
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel(`board-time-entries-realtime-${boardId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'demand_time_entries',
        },
        () => {
          // Invalidate and refetch when any time entry changes
          queryClient.invalidateQueries({ queryKey: ["board-time-entries", boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, queryClient]);

  return query;
}

// Get aggregated stats per user for a board (only users with time entries)
export function useBoardUserTimeStats(boardId: string | null) {
  const { data: entries, isLoading } = useBoardTimeEntries(boardId);

  const stats = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const userMap = new Map<string, BoardUserTimeStats>();
    const userDemandData = new Map<string, { 
      demandIds: Set<string>;
      deliveredIds: Set<string>;
      inProgressIds: Set<string>;
    }>();

    for (const entry of entries) {
      const userId = entry.user_id;
      const existing = userMap.get(userId);
      
      const entrySeconds = entry.duration_seconds || 0;
      const isActive = !entry.ended_at;
      const isDelivered = entry.demand.status?.name?.toLowerCase() === "entregue";

      if (!userDemandData.has(userId)) {
        userDemandData.set(userId, { 
          demandIds: new Set(), 
          deliveredIds: new Set(), 
          inProgressIds: new Set() 
        });
      }
      const demandData = userDemandData.get(userId)!;
      demandData.demandIds.add(entry.demand_id);
      if (isDelivered) {
        demandData.deliveredIds.add(entry.demand_id);
      } else {
        demandData.inProgressIds.add(entry.demand_id);
      }
      
      if (existing) {
        existing.totalSeconds += entrySeconds;
        existing.entries.push(entry);
        if (isActive && !existing.isActive) {
          existing.isActive = true;
          existing.activeStartedAt = entry.started_at;
        }
      } else {
        userMap.set(userId, {
          userId,
          profile: entry.profile,
          totalSeconds: entrySeconds,
          isActive,
          activeStartedAt: isActive ? entry.started_at : null,
          demandCount: 0,
          deliveredCount: 0,
          inProgressCount: 0,
          entries: [entry],
        });
      }
    }

    // Set demand counts
    for (const [userId, stats] of userMap) {
      const demandData = userDemandData.get(userId);
      if (demandData) {
        stats.demandCount = demandData.demandIds.size;
        stats.deliveredCount = demandData.deliveredIds.size;
        stats.inProgressCount = demandData.inProgressIds.size;
      }
    }

    // Sort by total time descending
    return Array.from(userMap.values()).sort((a, b) => {
      // Active timers first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return b.totalSeconds - a.totalSeconds;
    });
  }, [entries]);

  // Count active timers
  const activeTimersCount = useMemo(() => {
    return stats.filter(s => s.isActive).length;
  }, [stats]);

  return { data: stats, isLoading, activeTimersCount };
}

// NEW: Get ALL board members with their time stats (including those with 0 time)
export function useBoardMembersWithTime(boardId: string | null) {
  const queryClient = useQueryClient();
  const instanceId = useRef(createRealtimeInstanceId());
  
  const { data: entries, isLoading: entriesLoading } = useBoardTimeEntries(boardId);

  const query = useQuery({
    queryKey: ["board-members-with-time", boardId],
    queryFn: async () => {
      if (!boardId) return [];

      // Fetch ALL board members
      const { data: members, error } = await supabase
        .from("board_members")
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("board_id", boardId)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      return members.map((member: any) => ({
        id: member.id,
        userId: member.user_id,
        role: member.role,
        profile: member.profiles || { id: member.user_id, full_name: "Usuário", avatar_url: null },
      }));
    },
    enabled: !!boardId,
  });

  // Combine members with their time stats
  const membersWithTime = useMemo((): BoardMemberWithTime[] => {
    if (!query.data) return [];

    const entriesByUser = new Map<string, BoardTimeEntry[]>();
    const demandDataByUser = new Map<string, { 
      demandIds: Set<string>;
      deliveredIds: Set<string>;
      inProgressIds: Set<string>;
    }>();
    
    // Group entries by user
    if (entries) {
      for (const entry of entries) {
        const userId = entry.user_id;
        const isDelivered = entry.demand.status?.name?.toLowerCase() === "entregue";
        
        if (!entriesByUser.has(userId)) {
          entriesByUser.set(userId, []);
          demandDataByUser.set(userId, { 
            demandIds: new Set(), 
            deliveredIds: new Set(), 
            inProgressIds: new Set() 
          });
        }
        entriesByUser.get(userId)!.push(entry);
        
        const demandData = demandDataByUser.get(userId)!;
        demandData.demandIds.add(entry.demand_id);
        if (isDelivered) {
          demandData.deliveredIds.add(entry.demand_id);
        } else {
          demandData.inProgressIds.add(entry.demand_id);
        }
      }
    }

    // Map all members with their time data (excluding requesters - only internal members)
    return query.data
      .filter(member => member.role !== 'requester') // Exclude requesters - only show admins, moderators, executors
      .map(member => {
      const userEntries = entriesByUser.get(member.userId) || [];
      const demandData = demandDataByUser.get(member.userId) || { 
        demandIds: new Set(), 
        deliveredIds: new Set(), 
        inProgressIds: new Set() 
      };
      
      let totalSeconds = 0;
      let isActive = false;
      let activeStartedAt: string | null = null;

      for (const entry of userEntries) {
        totalSeconds += entry.duration_seconds || 0;
        if (!entry.ended_at) {
          isActive = true;
          if (!activeStartedAt || new Date(entry.started_at) > new Date(activeStartedAt)) {
            activeStartedAt = entry.started_at;
          }
        }
      }

      return {
        userId: member.userId,
        profile: member.profile,
        role: member.role,
        totalSeconds,
        isActive,
        activeStartedAt,
        demandCount: demandData.demandIds.size,
        deliveredCount: demandData.deliveredIds.size,
        inProgressCount: demandData.inProgressIds.size,
        entries: userEntries,
      };
    }).sort((a, b) => {
      // Active timers first, then by time descending
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return b.totalSeconds - a.totalSeconds;
    });
  }, [query.data, entries]);

  // Realtime subscription for board members
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel(`board-members-realtime-${boardId}-${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_members',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["board-members-with-time", boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, queryClient]);

  const activeTimersCount = useMemo(() => {
    return membersWithTime.filter(m => m.isActive).length;
  }, [membersWithTime]);

  return {
    data: membersWithTime,
    isLoading: query.isLoading || entriesLoading,
    activeTimersCount,
  };
}
