import { useState, useMemo, useRef } from "react";
import { useSubdemands, useReorderSubdemands } from "@/hooks/useSubdemands";
import { useBatchDependencyInfo } from "@/hooks/useDependencyCheck";
import { validateSubdemandOrder } from "@/lib/subdemandOrderUtils";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { formatDemandCode } from "@/lib/demandCodeUtils";
import { cn } from "@/lib/utils";
import { Lock, Link2, GripVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KanbanSubdemandsListProps {
  demandId: string;
  onSubdemandClick?: (id: string) => void;
  canReorder?: boolean;
}

const MAX_VISIBLE = 2;

function formatTimeSeconds(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ""}`;
  return `${m}m`;
}

export function KanbanSubdemandsList({ demandId, onSubdemandClick, canReorder = true }: KanbanSubdemandsListProps) {
  const { data: subdemands } = useSubdemands(demandId);
  const reorder = useReorderSubdemands();
  const [expanded, setExpanded] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const subIds = useMemo(() => (subdemands || []).map(s => s.id), [subdemands]);
  const { data: depsMap } = useBatchDependencyInfo(subIds);

  const { data: timeEntriesMap } = useQuery({
    queryKey: ["subdemands-time-entries", subIds],
    queryFn: async () => {
      if (subIds.length === 0) return {};
      const { data, error } = await supabase
        .from("demand_time_entries")
        .select("demand_id, duration_seconds, ended_at")
        .in("demand_id", subIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const entry of data || []) {
        if (entry.ended_at) {
          map[entry.demand_id] = (map[entry.demand_id] || 0) + (entry.duration_seconds || 0);
        }
      }
      return map;
    },
    enabled: subIds.length > 0,
  });

  if (!subdemands || subdemands.length === 0) return null;

  const visible = expanded ? subdemands : subdemands.slice(0, MAX_VISIBLE);
  const hiddenCount = subdemands.length - MAX_VISIBLE;

  const handleDrop = async (targetId: string) => {
    const sourceId = draggingIdRef.current;
    draggingIdRef.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId || !subdemands) return;

    const ids = subdemands.map(s => s.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;

    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, sourceId);

    const violation = validateSubdemandOrder(next, depsMap);
    if (violation) {
      toast.error(violation);
      return;
    }

    try {
      await reorder.mutateAsync({ parentDemandId: demandId, orderedIds: next });
    } catch (e: any) {
      toast.error("Não foi possível reordenar as subdemandas");
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {visible.map((sub) => {
        const color = sub.demand_statuses?.color || "#6B7280";
        const statusName = sub.demand_statuses?.name || "Sem status";
        const assignees = sub.demand_assignees || [];
        const timeStr = formatTimeSeconds(timeEntriesMap?.[sub.id] || 0);
        const code = sub.board_sequence_number ? formatDemandCode(sub.board_sequence_number) : null;
        const deps = depsMap?.[sub.id] || [];
        const isBlocked = deps.some(d => d.isBlocked);
        const isDragOver = dragOverId === sub.id;

        return (
          <div
            key={sub.id}
            draggable={canReorder}
            onDragStart={(e) => {
              if (!canReorder) return;
              e.stopPropagation();
              draggingIdRef.current = sub.id;
              e.dataTransfer.effectAllowed = "move";
              // Mark with a custom mime so kanban column drop ignores it
              e.dataTransfer.setData("application/x-subdemand-id", sub.id);
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              draggingIdRef.current = null;
              setDragOverId(null);
            }}
            onDragOver={(e) => {
              if (!canReorder) return;
              if (!e.dataTransfer.types.includes("application/x-subdemand-id")) return;
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              setDragOverId(sub.id);
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              if (dragOverId === sub.id) setDragOverId(null);
            }}
            onDrop={(e) => {
              if (!canReorder) return;
              if (!e.dataTransfer.types.includes("application/x-subdemand-id")) return;
              e.preventDefault();
              e.stopPropagation();
              handleDrop(sub.id);
            }}
            className={cn(
              "group relative rounded-md overflow-hidden transition-all",
              isDragOver && "ring-2 ring-primary ring-offset-1"
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSubdemandClick?.(sub.id);
              }}
              className="w-full text-left transition-opacity hover:opacity-80"
              title={`${sub.title} — ${statusName}`}
            >
              <div
                className="px-3 py-2 flex items-center gap-2"
                style={{ backgroundColor: color }}
              >
                {canReorder && (
                  <GripVertical
                    className="h-3 w-3 text-white/70 shrink-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {deps.length > 0 && (
                  isBlocked
                    ? <Lock className="h-3 w-3 text-white/90 shrink-0" />
                    : <Link2 className="h-3 w-3 text-white/70 shrink-0" />
                )}
                <span className="text-xs font-semibold text-white truncate flex-1 drop-shadow-sm">
                  {code && <span className="opacity-80 mr-1.5">{code}</span>}
                  {sub.title}
                </span>
                {timeStr && (
                  <span className="text-[10px] text-white/80 font-mono shrink-0">
                    {timeStr}
                  </span>
                )}
                {assignees.length > 0 && (
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <AssigneeAvatars assignees={assignees} size="sm" maxVisible={2} />
                  </div>
                )}
              </div>
              {deps.length > 0 && isBlocked && (
                <div className="px-2.5 py-1 bg-red-500/10 text-[10px] text-red-600 font-medium truncate flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5 shrink-0" />
                  Depende de: {deps.find(d => d.isBlocked)?.dependsOnTitle}
                </div>
              )}
            </button>
          </div>
        );
      })}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="text-xs text-primary font-medium hover:underline w-full text-center"
        >
          Ver mais ({hiddenCount})
        </button>
      )}
      {expanded && subdemands.length > MAX_VISIBLE && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="text-xs text-muted-foreground hover:underline w-full text-center"
        >
          Ver menos
        </button>
      )}
    </div>
  );
}
