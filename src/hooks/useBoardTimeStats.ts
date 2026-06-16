import { useMemo } from "react";
import { startOfDay, subDays, format } from "date-fns";
import { BoardTimeEntry, useBoardTimeEntries } from "./useBoardTimeEntries";

export interface DailyTimeData {
  date: string;
  dateFormatted: string;
  totalSeconds: number;
  entriesCount: number;
}

export interface StatusTimeData {
  statusName: string;
  statusColor: string;
  totalSeconds: number;
  demandCount: number;
}

export interface BoardTimeStats {
  totalTimeSeconds: number;
  totalDemands: number;
  totalEntries: number;
  activeTimersCount: number;
  avgTimePerUser: number;
  avgTimePerDemand: number;
  earliestActiveStart: string | null;
  dailyTrend: DailyTimeData[];
  statusDistribution: StatusTimeData[];
}

export function useBoardTimeStats(boardId: string | null, days = 7) {
  const { data: entries, isLoading } = useBoardTimeEntries(boardId);

  const stats = useMemo((): BoardTimeStats => {
    if (!entries || entries.length === 0) {
      return {
        totalTimeSeconds: 0,
        totalDemands: 0,
        totalEntries: 0,
        activeTimersCount: 0,
        avgTimePerUser: 0,
        avgTimePerDemand: 0,
        earliestActiveStart: null,
        dailyTrend: [],
        statusDistribution: [],
      };
    }

    // Basic aggregations
    let totalTimeSeconds = 0;
    let activeTimersCount = 0;
    let earliestActiveStart: string | null = null;
    const uniqueDemands = new Set<string>();
    const uniqueUsers = new Set<string>();

    for (const entry of entries) {
      totalTimeSeconds += entry.duration_seconds || 0;
      uniqueDemands.add(entry.demand_id);
      uniqueUsers.add(entry.user_id);
      
      if (!entry.ended_at) {
        activeTimersCount++;
        if (!earliestActiveStart || new Date(entry.started_at) < new Date(earliestActiveStart)) {
          earliestActiveStart = entry.started_at;
        }
      }
    }

    const totalDemands = uniqueDemands.size;
    const totalUsers = uniqueUsers.size;
    const avgTimePerUser = totalUsers > 0 ? Math.round(totalTimeSeconds / totalUsers) : 0;
    const avgTimePerDemand = totalDemands > 0 ? Math.round(totalTimeSeconds / totalDemands) : 0;

    // Daily trend for last N days
    const dailyMap = new Map<string, { totalSeconds: number; entriesCount: number }>();
    const today = startOfDay(new Date());
    
    // Initialize all days
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(today, i);
      const key = format(day, "yyyy-MM-dd");
      dailyMap.set(key, { totalSeconds: 0, entriesCount: 0 });
    }

    // Fill with actual data
    for (const entry of entries) {
      const dayKey = format(new Date(entry.started_at), "yyyy-MM-dd");
      const existing = dailyMap.get(dayKey);
      if (existing) {
        existing.totalSeconds += entry.duration_seconds || 0;
        existing.entriesCount += 1;
      }
    }

    const dailyTrend: DailyTimeData[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      dateFormatted: format(new Date(date), "dd/MM"),
      totalSeconds: data.totalSeconds,
      entriesCount: data.entriesCount,
    }));

    // Status distribution
    const statusMap = new Map<string, { color: string; totalSeconds: number; demands: Set<string> }>();
    
    for (const entry of entries) {
      const statusName = entry.demand.status?.name || "Sem status";
      const statusColor = entry.demand.status?.color || "#6b7280";
      
      if (!statusMap.has(statusName)) {
        statusMap.set(statusName, { color: statusColor, totalSeconds: 0, demands: new Set() });
      }
      
      const statusData = statusMap.get(statusName)!;
      statusData.totalSeconds += entry.duration_seconds || 0;
      statusData.demands.add(entry.demand_id);
    }

    const statusDistribution: StatusTimeData[] = Array.from(statusMap.entries())
      .map(([statusName, data]) => ({
        statusName,
        statusColor: data.color,
        totalSeconds: data.totalSeconds,
        demandCount: data.demands.size,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    return {
      totalTimeSeconds,
      totalDemands,
      totalEntries: entries.length,
      activeTimersCount,
      avgTimePerUser,
      avgTimePerDemand,
      earliestActiveStart,
      dailyTrend,
      statusDistribution,
    };
  }, [entries, days]);

  return { stats, isLoading };
}
