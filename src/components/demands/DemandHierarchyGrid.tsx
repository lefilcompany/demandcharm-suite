import { useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { DemandCard } from "@/components/DemandCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDemandCode } from "@/lib/demandCodeUtils";

interface HierarchicalDemand {
  id: string;
  title: string;
  parent_demand_id?: string | null;
  children?: HierarchicalDemand[];
  [key: string]: any;
}

interface DemandHierarchyGridProps {
  data: HierarchicalDemand[];
  onDemandClick: (demandId: string, boardId?: string) => void;
}

function buildHierarchy(demands: HierarchicalDemand[]): HierarchicalDemand[] {
  const map = new Map<string, HierarchicalDemand>();
  const topLevel: HierarchicalDemand[] = [];

  demands.forEach((d) => map.set(d.id, { ...d, children: [] }));

  demands.forEach((d) => {
    if (d.parent_demand_id && map.has(d.parent_demand_id)) {
      map.get(d.parent_demand_id)!.children!.push(map.get(d.id)!);
    }
  });

  demands.forEach((d) => {
    if (!d.parent_demand_id || !map.has(d.parent_demand_id)) {
      topLevel.push(map.get(d.id)!);
    }
  });

  return topLevel;
}

function ParentCardGroup({ demand, onDemandClick }: { demand: HierarchicalDemand; onDemandClick: (id: string, boardId?: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = (demand.children?.length || 0) > 0;

  if (!hasChildren) {
    return (
      <DemandCard
        demand={demand}
        onClick={() => onDemandClick(demand.id, demand.board_id)}
        showFullDetails
      />
    );
  }

  return (
    <div className="space-y-0">
      {/* Parent card with expand indicator */}
      <div className="relative">
        <DemandCard
          demand={demand}
          onClick={() => onDemandClick(demand.id, demand.board_id)}
          showFullDetails
        />
        {/* Expand toggle overlay at bottom */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            "absolute -bottom-3 left-1/2 -translate-x-1/2 z-10",
            "flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium",
            "bg-primary text-primary-foreground shadow-md",
            "hover:bg-primary/90 transition-all"
          )}
        >
          <Layers className="h-3 w-3" />
          <span>{demand.children!.length} subdemanda{demand.children!.length > 1 ? "s" : ""}</span>
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>

      {/* Subdemands */}
      {isExpanded && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-primary/30 space-y-3">
          {demand.children!.map((child) => (
            <DemandCard
              key={child.id}
              demand={child}
              onClick={() => onDemandClick(child.id, child.board_id)}
              showFullDetails
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DemandHierarchyGrid({ data, onDemandClick }: DemandHierarchyGridProps) {
  const hierarchy = buildHierarchy(data);

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {hierarchy.map((demand) => (
        <ParentCardGroup
          key={demand.id}
          demand={demand}
          onDemandClick={onDemandClick}
        />
      ))}
    </div>
  );
}
