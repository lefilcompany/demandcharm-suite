import { Clock, Users, GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface SubdemandTimeInfo {
  id: string;
  title: string;
  board_sequence_number: number | null;
  statusName: string;
  statusColor: string;
  totalSeconds: number;
  hasActiveTimer: boolean;
  activeStartedAt: string | null;
}

// Individual subdemand time row with live timer
function SubdemandTimeRow({ sub }: { sub: SubdemandTimeInfo }) {
  const navigate = useNavigate();
  const liveTime = useLiveTimer({
    isActive: sub.hasActiveTimer,
    baseSeconds: sub.totalSeconds,
    lastStartedAt: sub.activeStartedAt,
  });

  const displayTime = liveTime || formatTimeDisplay(sub.totalSeconds) || "00:00:00";

  return (
    <div className="flex items-center gap-2 py-1">
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: sub.statusColor }}
      />
      <button
        type="button"
        onClick={() => navigate(`/demands/${sub.id}`)}
        className="text-xs text-muted-foreground flex-1 truncate text-left hover:text-primary hover:underline cursor-pointer transition-colors"
      >
        {sub.board_sequence_number ? `#${String(sub.board_sequence_number).padStart(4, "0")} ` : ""}
        {sub.title}
      </button>
      <div className="flex items-center gap-1">
        {sub.hasActiveTimer && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
        <span className={cn(
          "font-mono text-xs",
          sub.hasActiveTimer ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        )}>
          {displayTime}
        </span>
      </div>
    </div>
  );
}

// Live total that re-renders when any child has active timer
function LiveAggregatedTotal({ subs }: { subs: SubdemandTimeInfo[] }) {
  // Sum base seconds from all subs
  const totalBase = subs.reduce((sum, s) => sum + s.totalSeconds, 0);
  
  // Find the earliest active timer to base live calculation on
  const activeSubs = subs.filter(s => s.hasActiveTimer);
  const hasAnyActive = activeSubs.length > 0;
  
  // Calculate total live elapsed from all active timers
  const totalActiveElapsed = activeSubs.reduce((sum, s) => {
    if (s.activeStartedAt) {
      return sum + Math.floor((Date.now() - new Date(s.activeStartedAt).getTime()) / 1000);
    }
    return sum;
  }, 0);

  // Use a live timer for the first active sub to trigger re-renders
  const firstActive = activeSubs[0];
  useLiveTimer({
    isActive: hasAnyActive,
    baseSeconds: 0,
    lastStartedAt: firstActive?.activeStartedAt || null,
  });

  const grandTotal = totalBase + totalActiveElapsed;
  const displayTime = formatTimeDisplay(grandTotal) || "00:00:00";

  return (
    <span className="font-mono text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">
      {displayTime}
    </span>
  );
}

interface ParentDemandTimeDisplayProps {
  demandId: string;
  subdemandIds: string[];
}

export function ParentDemandTimeDisplay({ demandId, subdemandIds }: ParentDemandTimeDisplayProps) {
  // Fetch time entries for all subdemands
  const { data: subTimeData, isLoading } = useQuery({
    queryKey: ["parent-aggregated-time", demandId, subdemandIds],
    queryFn: async () => {
      if (subdemandIds.length === 0) return [];

      // Fetch subdemand details
      const { data: subdemands, error: subError } = await supabase
        .from("demands")
        .select("id, title, board_sequence_number, demand_statuses(name, color)")
        .in("id", subdemandIds);

      if (subError) throw subError;

      // Fetch all time entries for all subdemands
      const { data: entries, error: entriesError } = await supabase
        .from("demand_time_entries")
        .select("demand_id, started_at, ended_at, duration_seconds")
        .in("demand_id", subdemandIds);

      if (entriesError) throw entriesError;

      // Aggregate per subdemand
      const result: SubdemandTimeInfo[] = (subdemands || []).map(sub => {
        const subEntries = (entries || []).filter(e => e.demand_id === sub.id);
        const totalSeconds = subEntries
          .filter(e => e.ended_at !== null)
          .reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
        
        const activeEntry = subEntries.find(e => e.ended_at === null);

        return {
          id: sub.id,
          title: sub.title,
          board_sequence_number: sub.board_sequence_number,
          statusName: (sub.demand_statuses as any)?.name || "",
          statusColor: (sub.demand_statuses as any)?.color || "#9CA3AF",
          totalSeconds,
          hasActiveTimer: !!activeEntry,
          activeStartedAt: activeEntry?.started_at || null,
        };
      });

      return result;
    },
    enabled: subdemandIds.length > 0,
    refetchInterval: 30000, // Refresh every 30s
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subTimeData || subTimeData.length === 0) return null;

  const activeCount = subTimeData.filter(s => s.hasActiveTimer).length;

  return (
    <div className="space-y-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 md:p-4">
      {/* Summary header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/15 shrink-0">
          <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            Tempo Total (Subdemandas)
          </p>
          <div className="flex items-center gap-2">
            <LiveAggregatedTotal subs={subTimeData} />
            {activeCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Per-subdemand breakdown */}
      <div className="bg-muted/50 rounded-md px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Tempo por subdemanda
          </span>
          {activeCount > 0 && (
            <span className="text-xs text-emerald-600 ml-auto">
              {activeCount} ativa{activeCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {subTimeData.map(sub => (
            <SubdemandTimeRow key={sub.id} sub={sub} />
          ))}
        </div>
      </div>
    </div>
  );
}