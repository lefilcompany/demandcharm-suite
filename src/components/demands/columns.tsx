"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssigneeAvatars } from "@/components/AssigneeAvatars";
import { Wrench, AlertTriangle } from "lucide-react";
import { formatDemandCode } from "@/lib/demandCodeUtils";
import { formatDateOnlyBR, isDateOverdue, toDateOnly, parseDateOnly, isDemandOverdue, isDemandDeliveredLate } from "@/lib/dateUtils";
import { cn, truncateText } from "@/lib/utils";

// Define the demand type based on what useDemands returns
export interface DemandTableRow {
  id: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  due_date?: string | null;
  delivered_at?: string | null;
  is_overdue?: boolean | null;
  created_at?: string;
  updated_at?: string;
  time_in_progress_seconds?: number | null;
  last_started_at?: string | null;
  board_sequence_number?: number | null;
  service_id?: string | null;
  demand_statuses?: {
    name: string;
    color: string;
  } | null;
  services?: {
    id: string;
    name: string;
  } | null;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  demand_assignees?: Array<{
    user_id: string;
    profile?: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  }>;
  assigned_profile?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  boards?: {
    id: string;
    name: string;
  } | null;
}
const priorityConfig: Record<string, {
  label: string;
  className: string;
}> = {
  baixa: {
    label: "Baixa",
    className: "bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
  },
  média: {
    label: "Média",
    className: "bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-400"
  },
  alta: {
    label: "Alta",
    className: "bg-destructive/20 border-destructive/30 text-destructive"
  }
};

// Cell component for code
function CodeCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const code = formatDemandCode(row.original.board_sequence_number);
  if (!code) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  return (
    <div className="flex justify-center">
      <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-muted-foreground/20 font-mono">
        {code}
      </Badge>
    </div>
  );
}

// Cell component for title with high priority indicator
function TitleCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const isHighPriority = row.original.priority?.toLowerCase() === "alta";
  return <div className="flex items-center gap-2">
      {isHighPriority}
      <span className="font-medium text-foreground" title={row.original.title}>
        {truncateText(row.original.title)}
      </span>
    </div>;
}

// Cell component for assignees
function AssigneeCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const demandAssignees = row.original.demand_assignees;
  const assignedProfile = row.original.assigned_profile;

  // Mapear assignees de demand_assignees (filtrando os que têm profile)
  const assignees = (demandAssignees || []).filter((a): a is typeof a & {
    profile: NonNullable<typeof a.profile>;
  } => a.profile !== null && a.profile !== undefined).map(a => ({
    user_id: a.user_id,
    profile: {
      full_name: a.profile.full_name,
      avatar_url: a.profile.avatar_url
    }
  }));

  // Fallback para assigned_profile (sistema legado)
  if (assignees.length === 0 && assignedProfile) {
    assignees.push({
      user_id: "legacy",
      profile: {
        full_name: assignedProfile.full_name,
        avatar_url: assignedProfile.avatar_url
      }
    });
  }
  if (assignees.length === 0) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  return <div className="flex justify-center"><AssigneeAvatars assignees={assignees} maxVisible={3} size="sm" /></div>;
}

// Cell component for status
function StatusCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const status = row.original.demand_statuses;
  const isDeliveredLate = isDemandDeliveredLate(row.original);
  if (!status) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  if (isDeliveredLate) {
    return (
      <div className="flex justify-center">
        <Badge
          variant="outline"
          className="border bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          Entregue com atraso
        </Badge>
      </div>
    );
  }
  return <div className="flex justify-center"><Badge variant="outline" className="border" style={{
    backgroundColor: `${status.color}20`,
    borderColor: `${status.color}50`,
    color: status.color
  }}>
      {status.name}
    </Badge></div>;
}

// Cell component for due date (expiration date)
function DueDateCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const demand = row.original;
  const dueDate = demand.due_date;
  if (!dueDate) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  const isOverdue = isDemandOverdue(demand);
  const isDeliveredLate = isDemandDeliveredLate(demand);
  const formattedDate = formatDateOnlyBR(dueDate);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn("inline-flex items-center gap-1", isOverdue ? "text-destructive font-medium" : "text-foreground")}>
        {isOverdue && <AlertTriangle className="h-3 w-3" />}
        {formattedDate}
      </span>
      {isDeliveredLate && (
        <Badge
          variant="outline"
          className="text-[10px] py-0 h-5 bg-muted/50 text-muted-foreground border-muted-foreground/20 font-normal"
        >
          Concluída com atraso
        </Badge>
      )}
    </div>
  );
}

// Cell component for board name
function BoardCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const board = row.original.boards;
  if (!board) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  return (
    <div className="flex justify-center">
      <Badge variant="outline" className="text-xs bg-muted/50 border-border text-foreground font-medium">
        {board.name}
      </Badge>
    </div>
  );
}

// Cell component for priority
function PriorityCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const priority = row.original.priority?.toLowerCase();
  if (!priority) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  const config = priorityConfig[priority] || {
    label: priority,
    className: "bg-muted text-muted-foreground"
  };
  return <div className="flex justify-center"><Badge variant="outline" className={`border ${config.className}`}>
      {config.label}
    </Badge></div>;
}
// Cell component for service
function ServiceCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const service = row.original.services;
  return (
    <div className="flex justify-center">
      <Badge 
        variant="outline" 
        className={`text-xs flex items-center gap-1 w-fit ${
          service?.name 
            ? "bg-primary/5 text-primary border-primary/20" 
            : "bg-muted/50 text-muted-foreground border-muted-foreground/20"
        }`}
      >
        <Wrench className="h-3 w-3" />
        {service?.name || "Nenhum serviço"}
      </Badge>
    </div>
  );
}

// Cell component for creator
function CreatorCell({
  row
}: {
  row: {
    original: DemandTableRow;
  };
}) {
  const creator = row.original.profiles;
  if (!creator) {
    return <div className="flex justify-center"><span className="text-muted-foreground text-sm">—</span></div>;
  }
  
  const initials = creator.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex justify-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="h-7 w-7 cursor-pointer">
              <AvatarImage src={creator.avatar_url || undefined} alt={creator.full_name} />
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{creator.full_name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export const demandColumns: ColumnDef<DemandTableRow>[] = [{
  accessorKey: "board_sequence_number",
  header: "Código",
  cell: ({
    row
  }) => <CodeCell row={row} />,
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const numA = rowA.original.board_sequence_number || 0;
    const numB = rowB.original.board_sequence_number || 0;
    return numA - numB;
  }
}, {
  accessorKey: "title",
  header: "Título",
  cell: ({
    row
  }) => <TitleCell row={row} />,
  enableSorting: true
}, {
  id: "service",
  header: "Serviço",
  cell: ({
    row
  }) => <ServiceCell row={row} />,
  enableSorting: true,
  accessorFn: row => row.services?.name || "",
  sortingFn: (rowA, rowB) => {
    const serviceA = rowA.original.services?.name || "";
    const serviceB = rowB.original.services?.name || "";
    return serviceA.localeCompare(serviceB);
  }
}, {
  id: "creator",
  header: "Solicitante",
  cell: ({
    row
  }) => <CreatorCell row={row} />,
  enableSorting: true,
  accessorFn: row => row.profiles?.full_name || "",
  sortingFn: (rowA, rowB) => {
    const creatorA = rowA.original.profiles?.full_name || "";
    const creatorB = rowB.original.profiles?.full_name || "";
    return creatorA.localeCompare(creatorB);
  }
}, {
  id: "assignees",
  header: "Responsável",
  cell: ({
    row
  }) => <AssigneeCell row={row} />,
  enableSorting: false
}, {
  id: "status",
  header: "Status",
  cell: ({
    row
  }) => <StatusCell row={row} />,
  enableSorting: true,
  accessorFn: row => row.demand_statuses?.name || "",
  sortingFn: (rowA, rowB) => {
    const statusOrder: Record<string, number> = {
      "A Iniciar": 1,
      "Fazendo": 2,
      "Aprovação do Cliente": 3,
      "Em Ajuste": 4,
      "Entregue": 5
    };
    const statusA = rowA.original.demand_statuses?.name || "";
    const statusB = rowB.original.demand_statuses?.name || "";
    return (statusOrder[statusA] || 99) - (statusOrder[statusB] || 99);
  }
}, {
  accessorKey: "due_date",
  header: "Data de Expiração",
  cell: ({
    row
  }) => <DueDateCell row={row} />,
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const dateA = parseDateOnly(toDateOnly(rowA.original.due_date))?.getTime() ?? Infinity;
    const dateB = parseDateOnly(toDateOnly(rowB.original.due_date))?.getTime() ?? Infinity;
    return dateA - dateB;
  }
}, {
  id: "board",
  header: "Quadro",
  cell: ({
    row
  }) => <BoardCell row={row} />,
  enableSorting: true,
  accessorFn: row => row.boards?.name || "",
  sortingFn: (rowA, rowB) => {
    const boardA = rowA.original.boards?.name || "";
    const boardB = rowB.original.boards?.name || "";
    return boardA.localeCompare(boardB);
  }
}, {
  accessorKey: "priority",
  header: "Prioridade",
  cell: ({
    row
  }) => <PriorityCell row={row} />,
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const priorityOrder: Record<string, number> = {
      "baixa": 1,
      "média": 2,
      "alta": 3
    };
    const priorityA = rowA.original.priority?.toLowerCase() || "";
    const priorityB = rowB.original.priority?.toLowerCase() || "";
    return (priorityOrder[priorityA] || 0) - (priorityOrder[priorityB] || 0);
  }
}];