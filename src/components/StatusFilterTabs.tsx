import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { cn } from "@/lib/utils";

// Sentinel ID used to represent the synthetic "Entregue com atraso" filter
export const DELIVERED_LATE_FILTER_ID = "__delivered_late__";

// Ordem fixa dos status do sistema
const STATUS_ORDER = [
  "A Iniciar",
  "Tarefas Internas",
  "Fazendo",
  "Em Ajuste",
  "Aprovação Interna",
  "Aprovação do Cliente",
  "Entregue",
  "Atrasado",
];

// Status hidden from requesters
const REQUESTER_HIDDEN_STATUSES = ["Tarefas Internas"];

interface StatusFilterTabsProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  // Multi-select API (preferred when provided)
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  multiSelect?: boolean;
}

export function StatusFilterTabs({ value, onChange, values, onValuesChange, multiSelect }: StatusFilterTabsProps) {
  const { selectedBoardId } = useSelectedBoard();
  const { data: boardStatuses } = useBoardStatuses(selectedBoardId);
  const { data: boardRole } = useBoardRole(selectedBoardId);

  const isMulti = multiSelect ?? Array.isArray(values);
  const selectedSet = new Set(isMulti ? (values ?? []) : value ? [value] : []);
  const isAllSelected = selectedSet.size === 0;

  const handleAllClick = () => {
    if (isMulti) onValuesChange?.([]);
    else onChange?.(null);
  };

  const handleStatusClick = (statusId: string) => {
    if (isMulti) {
      const next = new Set(selectedSet);
      if (next.has(statusId)) next.delete(statusId);
      else next.add(statusId);
      onValuesChange?.(Array.from(next));
    } else {
      onChange?.(value === statusId ? null : statusId);
    }
  };

  // Ordenar status conforme ordem definida, usando os status do quadro atual
  const orderedStatuses = useMemo(() => {
    if (!boardStatuses) return [];

    let statuses = boardStatuses.map(bs => ({
      id: bs.status.id,
      name: bs.status.name,
      color: bs.status.color,
    }));

    if (boardRole === "requester") {
      statuses = statuses.filter(s => !REQUESTER_HIDDEN_STATUSES.includes(s.name));
    }

    return statuses.sort((a, b) => {
      const indexA = STATUS_ORDER.indexOf(a.name);
      const indexB = STATUS_ORDER.indexOf(b.name);
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      return orderA - orderB;
    });
  }, [boardStatuses, boardRole]);

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <button
        onClick={handleAllClick}
        className={cn(
          "px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0",
          "border border-border hover:bg-accent",
          isAllSelected && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
        )}
      >
        Todos
      </button>
      {orderedStatuses.map((status) => {
        const shortName = status.name === "Aprovação do Cliente" ? "Aprovação" : status.name;
        const isSelected = selectedSet.has(status.id);

        return (
          <button
            key={status.id}
            onClick={() => handleStatusClick(status.id)}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0",
              "border hover:opacity-80",
              isSelected ? "text-white" : "bg-background/50 text-foreground"
            )}
            style={{
              backgroundColor: isSelected ? status.color : undefined,
              borderColor: status.color,
            }}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0",
                isSelected && "bg-white/80"
              )}
              style={{
                backgroundColor: !isSelected ? status.color : undefined,
              }}
            />
            <span className="hidden sm:inline">{status.name}</span>
            <span className="sm:hidden">{shortName}</span>
          </button>
        );
      })}

      {/* Synthetic filter: Delivered late */}
      {(() => {
        const isSelected = selectedSet.has(DELIVERED_LATE_FILTER_ID);
        return (
          <button
            key={DELIVERED_LATE_FILTER_ID}
            onClick={() => handleStatusClick(DELIVERED_LATE_FILTER_ID)}
            className={cn(
              "px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0",
              "border hover:opacity-80",
              isSelected
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background/50 text-foreground border-amber-500/60"
            )}
          >
            <AlertTriangle className={cn("h-3 w-3 shrink-0", isSelected ? "text-white" : "text-amber-600")} />
            <span className="hidden sm:inline">Entregue com atraso</span>
            <span className="sm:hidden">Atraso</span>
          </button>
        );
      })()}
    </div>
  );
}
