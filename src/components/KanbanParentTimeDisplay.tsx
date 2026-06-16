import { Clock, GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";

interface SubTimeInfo {
  totalSeconds: number;
  hasActiveTimer: boolean;
  activeStartedAt: string | null;
}

function LiveTotal({ subs, inline }: { subs: SubTimeInfo[]; inline?: boolean }) {
  const totalBase = subs.reduce((sum, s) => sum + s.totalSeconds, 0);
  const activeSubs = subs.filter(s => s.hasActiveTimer);
  const hasAnyActive = activeSubs.length > 0;

  const totalActiveElapsed = activeSubs.reduce((sum, s) => {
    if (s.activeStartedAt) {
      return sum + Math.floor((Date.now() - new Date(s.activeStartedAt).getTime()) / 1000);
    }
    return sum;
  }, 0);

  useLiveTimer({
    isActive: hasAnyActive,
    baseSeconds: 0,
    lastStartedAt: activeSubs[0]?.activeStartedAt || null,
  });

  const grandTotal = totalBase + totalActiveElapsed;
  const displayTime = formatTimeDisplay(grandTotal) || "00:00:00";

  if (inline) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-md px-1.5 py-0.5 min-w-0">
        <Clock className="h-2.5 w-2.5 shrink-0" />
        <span className="font-mono font-medium truncate min-w-0">{displayTime}</span>
        {hasAnyActive && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded-md px-2 py-1 mb-2 overflow-hidden min-w-0">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="text-[10px] uppercase font-medium shrink-0 flex items-center gap-0.5">
        <GitBranch className="h-2.5 w-2.5" />
        Soma:
      </span>
      <span className="font-mono font-medium truncate min-w-0 flex-1">{displayTime}</span>
      {hasAnyActive && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {activeSubs.length > 0 && (
        <span className="text-[10px] shrink-0">{activeSubs.length} ativa{activeSubs.length > 1 ? "s" : ""}</span>
      )}
    </div>
  );
}

interface KanbanParentTimeDisplayProps {
  demandId: string;
  subdemandIds?: string[];
  inline?: boolean;
}

export function KanbanParentTimeDisplay({ demandId, subdemandIds, inline }: KanbanParentTimeDisplayProps) {
  const { data: resolvedSubdemandIds } = useQuery({
    queryKey: ["kanban-parent-subdemand-ids", demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("id")
        .eq("parent_demand_id", demandId)
        .eq("archived", false);

      if (error) throw error;
      return (data || []).map((item) => item.id);
    },
    enabled: !!demandId && !subdemandIds,
  });

  const effectiveSubdemandIds = subdemandIds ?? resolvedSubdemandIds ?? [];

  const { data: subTimeData } = useQuery({
    queryKey: ["kanban-parent-time", demandId, effectiveSubdemandIds],
    queryFn: async () => {
      if (effectiveSubdemandIds.length === 0) return [];

      const { data: entries, error } = await supabase
        .from("demand_time_entries")
        .select("demand_id, started_at, ended_at, duration_seconds")
        .in("demand_id", effectiveSubdemandIds);

      if (error) throw error;

      return effectiveSubdemandIds.map(subId => {
        const subEntries = (entries || []).filter(e => e.demand_id === subId);
        const totalSeconds = subEntries.reduce((sum, e) => {
          if (!e.ended_at) return sum;
          return sum + (e.duration_seconds || 0);
        }, 0);
        const activeEntry = subEntries.find(e => e.ended_at === null);

        return {
          totalSeconds,
          hasActiveTimer: !!activeEntry,
          activeStartedAt: activeEntry?.started_at || null,
        } as SubTimeInfo;
      });
    },
    enabled: effectiveSubdemandIds.length > 0,
    refetchInterval: 5000,
  });

  if (!subTimeData || subTimeData.length === 0) return null;

  const totalBase = subTimeData.reduce((s, x) => s + x.totalSeconds, 0);
  const hasAnyActive = subTimeData.some(s => s.hasActiveTimer);

  if (totalBase === 0 && !hasAnyActive) return null;

  return <LiveTotal subs={subTimeData} inline={inline} />;
}
