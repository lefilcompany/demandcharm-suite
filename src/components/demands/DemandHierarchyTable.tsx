import { useState, Fragment } from "react";
import { ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DemandTableRow } from "./columns";
import { formatDemandCode } from "@/lib/demandCodeUtils";
import { formatDateOnlyBR, isDateOverdue, isDemandOverdue, isDemandDeliveredLate } from "@/lib/dateUtils";
import { truncateText } from "@/lib/utils";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Wrench } from "lucide-react";
import { parseDateOnly, toDateOnly } from "@/lib/dateUtils";

export interface HierarchicalDemand extends DemandTableRow {
  parent_demand_id?: string | null;
  children?: HierarchicalDemand[];
}

interface DemandHierarchyTableProps {
  data: HierarchicalDemand[];
  onRowClick?: (row: HierarchicalDemand) => void;
}

const priorityOrder: Record<string, number> = { baixa: 1, média: 2, alta: 3 };
const statusOrder: Record<string, number> = { "A Iniciar": 1, "Fazendo": 2, "Aprovação do Cliente": 3, "Em Ajuste": 4, "Entregue": 5 };

type SortKey = "code" | "title" | "service" | "creator" | "status" | "due_date" | "board" | "priority";
type SortDir = "asc" | "desc";

const priorityConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400" },
  média: { label: "Média", className: "bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-400" },
  alta: { label: "Alta", className: "bg-destructive/20 border-destructive/30 text-destructive" },
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function buildHierarchy(demands: HierarchicalDemand[]): HierarchicalDemand[] {
  const parentMap = new Map<string, HierarchicalDemand>();
  const childMap = new Map<string, HierarchicalDemand[]>();
  const topLevel: HierarchicalDemand[] = [];

  // First pass: index all demands and find children
  demands.forEach((d) => {
    parentMap.set(d.id, { ...d, children: [] });
  });

  demands.forEach((d) => {
    if (d.parent_demand_id && parentMap.has(d.parent_demand_id)) {
      const parent = parentMap.get(d.parent_demand_id)!;
      parent.children!.push(parentMap.get(d.id)!);
    }
  });

  // Second pass: collect top-level items (no parent or parent not in current list)
  demands.forEach((d) => {
    if (!d.parent_demand_id || !parentMap.has(d.parent_demand_id)) {
      topLevel.push(parentMap.get(d.id)!);
    }
  });

  return topLevel;
}

function sortHierarchy(items: HierarchicalDemand[], sortKey: SortKey, sortDir: SortDir): HierarchicalDemand[] {
  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "code":
        cmp = (a.board_sequence_number || 0) - (b.board_sequence_number || 0);
        break;
      case "title":
        cmp = (a.title || "").localeCompare(b.title || "");
        break;
      case "service":
        cmp = (a.services?.name || "").localeCompare(b.services?.name || "");
        break;
      case "creator":
        cmp = (a.profiles?.full_name || "").localeCompare(b.profiles?.full_name || "");
        break;
      case "status":
        cmp = (statusOrder[a.demand_statuses?.name || ""] || 99) - (statusOrder[b.demand_statuses?.name || ""] || 99);
        break;
      case "due_date": {
        const da = parseDateOnly(toDateOnly(a.due_date))?.getTime() ?? Infinity;
        const db = parseDateOnly(toDateOnly(b.due_date))?.getTime() ?? Infinity;
        cmp = da - db;
        break;
      }
      case "board":
        cmp = ((a as any).boards?.name || "").localeCompare((b as any).boards?.name || "");
        break;
      case "priority":
        cmp = (priorityOrder[a.priority?.toLowerCase() || ""] || 0) - (priorityOrder[b.priority?.toLowerCase() || ""] || 0);
        break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });
  return sorted;
}

export function DemandHierarchyTable({ data, onRowClick }: DemandHierarchyTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const hierarchy = buildHierarchy(data);
  const sorted = sortHierarchy(hierarchy, sortKey, sortDir);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedParents = sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderRow = (demand: HierarchicalDemand, isChild = false) => {
    const hasChildren = (demand.children?.length || 0) > 0;
    const isExpanded = expandedIds.has(demand.id);
    const code = formatDemandCode(demand.board_sequence_number);
    const status = demand.demand_statuses;
    const service = demand.services;
    const priority = demand.priority?.toLowerCase();
    const pConfig = priority ? priorityConfig[priority] : null;
    const creator = demand.profiles;
    const dueDate = demand.due_date;
    const isOverdue = isDemandOverdue(demand);
    const isDeliveredLate = isDemandDeliveredLate(demand);
    const board = (demand as any).boards;

    const assignees = (demand.demand_assignees || [])
      .filter((a): a is typeof a & { profile: NonNullable<typeof a.profile> } => !!a.profile)
      .map((a) => ({ user_id: a.user_id, profile: { full_name: a.profile.full_name, avatar_url: a.profile.avatar_url } }));
    if (assignees.length === 0 && demand.assigned_profile) {
      assignees.push({ user_id: "legacy", profile: { full_name: demand.assigned_profile.full_name, avatar_url: demand.assigned_profile.avatar_url } });
    }

    const creatorInitials = creator?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <TableRow
        key={demand.id}
        onClick={() => onRowClick?.(demand)}
        className={`cursor-pointer hover:bg-muted/50 transition-colors ${isChild ? "bg-muted/20" : ""}`}
      >
        {/* Code + expand */}
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            {isChild ? (
              <span className="w-5 inline-block text-muted-foreground">↳</span>
            ) : hasChildren ? (
              <button
                onClick={(e) => toggleExpand(demand.id, e)}
                className="w-5 h-5 inline-flex items-center justify-center rounded hover:bg-muted transition-colors"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-5 inline-block" />
            )}
            {code ? (
              <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-muted-foreground/20 font-mono">
                {code}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
            {hasChildren && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                {demand.children!.length}
              </Badge>
            )}
          </div>
        </TableCell>
        {/* Title */}
        <TableCell>
          <div className={`flex items-center gap-2 ${isChild ? "pl-2" : ""}`}>
            <span className="font-medium text-foreground" title={demand.title}>
              {truncateText(demand.title)}
            </span>
          </div>
        </TableCell>
        {/* Service */}
        <TableCell className="text-center">
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className={`text-xs flex items-center gap-1 w-fit ${
                service?.name ? "bg-primary/5 text-primary border-primary/20" : "bg-muted/50 text-muted-foreground border-muted-foreground/20"
              }`}
            >
              <Wrench className="h-3 w-3" />
              {service?.name || "Nenhum serviço"}
            </Badge>
          </div>
        </TableCell>
        {/* Creator */}
        <TableCell className="text-center">
          {creator ? (
            <div className="flex justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-7 w-7 cursor-pointer">
                      <AvatarImage src={creator.avatar_url || undefined} alt={creator.full_name} />
                      <AvatarFallback className="text-[10px]">{creatorInitials}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent><p>{creator.full_name}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>
          )}
        </TableCell>
        {/* Assignees */}
        <TableCell className="text-center">
          {assignees.length > 0 ? (
            <div className="flex justify-center"><AssigneeAvatars assignees={assignees} maxVisible={3} size="sm" /></div>
          ) : (
            <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>
          )}
        </TableCell>
        {/* Status */}
        <TableCell className="text-center">
          {isDeliveredLate ? (
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className="border bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1"
              >
                <AlertTriangle className="h-3 w-3" />
                Entregue com atraso
              </Badge>
            </div>
          ) : status ? (
            <div className="flex justify-center">
              <Badge variant="outline" className="border" style={{ backgroundColor: `${status.color}20`, borderColor: `${status.color}50`, color: status.color }}>
                {status.name}
              </Badge>
            </div>
          ) : (
            <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>
          )}
        </TableCell>
        {/* Due date */}
        <TableCell className="text-center">
          {dueDate ? (
            <div className="flex justify-center">
              <span className={isOverdue ? "text-destructive font-medium" : "text-foreground"}>{formatDateOnlyBR(dueDate)}</span>
            </div>
          ) : (
            <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>
          )}
        </TableCell>
        {/* Board */}
        <TableCell className="text-center">
          {board?.name ? (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs bg-muted/50 border-border text-foreground font-medium">{board.name}</Badge>
            </div>
          ) : (
            <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>
          )}
        </TableCell>
        {/* Priority */}
        <TableCell className="text-center">
          {pConfig ? (
            <div className="flex justify-center">
              <Badge variant="outline" className={`border ${pConfig.className}`}>{pConfig.label}</Badge>
            </div>
          ) : (
            <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const currentPage = pageIndex + 1;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPageIndex(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const cols: { key: SortKey; label: string; sortable: boolean }[] = [
    { key: "code", label: "Código", sortable: true },
    { key: "title", label: "Título", sortable: true },
    { key: "service", label: "Serviço", sortable: true },
    { key: "creator", label: "Solicitante", sortable: true },
    { key: "code", label: "Responsável", sortable: false },
    { key: "status", label: "Status", sortable: true },
    { key: "due_date", label: "Data de Expiração", sortable: true },
    { key: "board", label: "Quadro", sortable: true },
    { key: "priority", label: "Prioridade", sortable: true },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((col, idx) => (
                <TableHead
                  key={idx}
                  className={`text-center ${col.sortable ? "cursor-pointer select-none hover:bg-muted/50 transition-colors" : ""}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center justify-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon col={col.key} />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedParents.length > 0 ? (
              paginatedParents.map((parent) => (
                <Fragment key={parent.id}>
                  {renderRow(parent, false)}
                  {expandedIds.has(parent.id) &&
                    parent.children?.map((child) => renderRow(child, true))}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Itens por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPageIndex(0);
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {totalPages > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Página {currentPage} de {totalPages}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => p - 1)} disabled={pageIndex === 0}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => p + 1)} disabled={pageIndex >= totalPages - 1}>
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}
