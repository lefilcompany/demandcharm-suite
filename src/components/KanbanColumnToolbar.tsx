import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, X, ArrowUpDown, ArrowDown, ArrowUp, Calendar, Clock, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export type KanbanSortOption = "newest" | "oldest" | "priority_high" | "priority_low" | "due_date_asc" | "due_date_desc" | "sequence";

interface KanbanColumnToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: KanbanSortOption;
  onSortChange: (option: KanbanSortOption) => void;
}

const SORT_OPTIONS: { value: KanbanSortOption; label: string; icon: React.ReactNode }[] = [
  { value: "newest", label: "Mais recente na etapa", icon: <ArrowDown className="h-3 w-3" /> },
  { value: "oldest", label: "Mais antigo na etapa", icon: <ArrowUp className="h-3 w-3" /> },
  { value: "priority_high", label: "Prioridade (alta → baixa)", icon: <ArrowDown className="h-3 w-3" /> },
  { value: "priority_low", label: "Prioridade (baixa → alta)", icon: <ArrowUp className="h-3 w-3" /> },
  { value: "due_date_asc", label: "Prazo (próximo)", icon: <Calendar className="h-3 w-3" /> },
  { value: "due_date_desc", label: "Prazo (distante)", icon: <Calendar className="h-3 w-3" /> },
  { value: "sequence", label: "Número (#)", icon: <Hash className="h-3 w-3" /> },
];

export function KanbanColumnToolbar({ searchQuery, onSearchChange, sortOption, onSortChange }: KanbanColumnToolbarProps) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchExpanded) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchExpanded]);

  const collapseSearch = () => {
    setSearchExpanded(false);
    onSearchChange("");
  };

  const currentSort = SORT_OPTIONS.find(o => o.value === sortOption) || SORT_OPTIONS[0];

  return (
    <div className="flex items-center gap-1">
      {/* Expandable search */}
      {searchExpanded ? (
        <div className="relative flex items-center animate-in fade-in slide-in-from-right-2 duration-200">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") collapseSearch();
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="pl-7 pr-6 h-6 w-[120px] text-xs bg-background/80 border-border/50"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              collapseSearch();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-background/50"
          onClick={(e) => {
            e.stopPropagation();
            setSearchExpanded(true);
          }}
          title="Buscar na coluna"
        >
          <Search className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-background/50"
            onClick={(e) => e.stopPropagation()}
            title={`Ordenar: ${currentSort.label}`}
          >
            <ArrowUpDown className={cn("h-3 w-3", sortOption !== "due_date_asc" ? "text-primary" : "text-muted-foreground")} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background min-w-[200px]" onClick={(e) => e.stopPropagation()}>
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                onSortChange(option.value);
              }}
              className={cn(
                "cursor-pointer text-xs gap-2",
                sortOption === option.value && "bg-primary/10 text-primary font-medium"
              )}
            >
              {option.icon}
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Priority weight map for sorting
const PRIORITY_WEIGHTS: Record<string, number> = {
  urgente: 4,
  alta: 3,
  média: 2,
  baixa: 1,
};

export function filterAndSortDemands<T extends {
  id?: string;
  title: string;
  description?: string | null;
  board_sequence_number?: number | null;
  priority?: string | null;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
  status_changed_at?: string | null;
  parent_demand_id?: string | null;
}>(
  demands: T[],
  searchQuery: string,
  sortOption: KanbanSortOption,
  dependencyMap?: Record<string, { isBlocked: boolean }[]>
): T[] {
  let filtered = demands;

  // Filter by search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = demands.filter((d) => {
      if (d.title.toLowerCase().includes(q)) return true;
      if (d.description?.toLowerCase().includes(q)) return true;
      if (d.board_sequence_number && String(d.board_sequence_number).includes(q)) return true;
      return false;
    });
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortOption) {
      case "newest":
        return new Date(b.status_changed_at || b.updated_at || b.created_at || 0).getTime() - new Date(a.status_changed_at || a.updated_at || a.created_at || 0).getTime();
      case "oldest":
        return new Date(a.status_changed_at || a.updated_at || a.created_at || 0).getTime() - new Date(b.status_changed_at || b.updated_at || b.created_at || 0).getTime();
      case "priority_high": {
        const wa = PRIORITY_WEIGHTS[a.priority || "média"] || 2;
        const wb = PRIORITY_WEIGHTS[b.priority || "média"] || 2;
        return wb - wa;
      }
      case "priority_low": {
        const wa = PRIORITY_WEIGHTS[a.priority || "média"] || 2;
        const wb = PRIORITY_WEIGHTS[b.priority || "média"] || 2;
        return wa - wb;
      }
      case "due_date_asc": {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      case "due_date_desc": {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      }
      case "sequence": {
        return (b.board_sequence_number || 0) - (a.board_sequence_number || 0);
      }
      default:
        return 0;
    }
  });

  // Group parent demands with their subdemands
  // Order: parent first, then subdemands without deps, then subdemands with deps
  const parentIds = new Set(sorted.filter(d => !d.parent_demand_id).map(d => (d as any).id as string).filter(Boolean));
  const subsByParent = new Map<string, T[]>();
  const standalone: T[] = [];

  for (const d of sorted) {
    if (d.parent_demand_id && parentIds.has(d.parent_demand_id)) {
      if (!subsByParent.has(d.parent_demand_id)) subsByParent.set(d.parent_demand_id, []);
      subsByParent.get(d.parent_demand_id)!.push(d);
    } else {
      standalone.push(d);
    }
  }

  // Sort subdemands: non-blocked first, blocked last
  if (dependencyMap) {
    for (const [, subs] of subsByParent) {
      subs.sort((a, b) => {
        const aId = (a as any).id as string;
        const bId = (b as any).id as string;
        const aBlocked = dependencyMap[aId]?.some(dep => dep.isBlocked) ? 1 : 0;
        const bBlocked = dependencyMap[bId]?.some(dep => dep.isBlocked) ? 1 : 0;
        return aBlocked - bBlocked;
      });
    }
  }

  // Rebuild: for each standalone item, if it's a parent, insert its subs right after
  const result: T[] = [];
  for (const d of standalone) {
    result.push(d);
    const dId = (d as any).id as string;
    const subs = subsByParent.get(dId);
    if (subs) {
      result.push(...subs);
    }
  }

  // Add orphan subdemands (parent not in same column)
  for (const d of sorted) {
    if (d.parent_demand_id && !parentIds.has(d.parent_demand_id) && !result.includes(d)) {
      result.push(d);
    }
  }

  return result;
}
