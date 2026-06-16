import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Filter, X, CalendarIcon, ChevronDown, Check, Briefcase, LayoutGrid } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useTeamPositions } from "@/hooks/useTeamPositions";
import { useBoards } from "@/hooks/useBoards";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const POSITION_FILTER_KEY = "teamDemandsPositionFilter";

export interface TeamDemandsFiltersState {
  status: string | null;
  priority: string | null;
  assignee: string | null;
  service: string | null;
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
  position: string | null;
  boards: string[];
}

interface TeamDemandsFiltersProps {
  teamId: string | null;
  filters: TeamDemandsFiltersState;
  onChange: (filters: TeamDemandsFiltersState) => void;
}

interface NativeSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string; color?: string }[];
  placeholder: string;
  showColorDot?: boolean;
  icon?: React.ReactNode;
}

function NativeSelect({ value, onChange, options, placeholder, showColorDot, icon }: NativeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background/50 px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      >
        <span className={`flex items-center gap-2 ${selectedOption ? "text-foreground" : "text-muted-foreground"}`}>
          {icon}
          {showColorDot && selectedOption?.color && (
            <div 
              className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" 
              style={{ backgroundColor: selectedOption.color }} 
            />
          )}
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value === "all" ? null : option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                  (option.value === "all" && !value) || option.value === value 
                    ? "bg-accent/50 font-medium" 
                    : ""
                }`}
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  {(option.value === "all" && !value) || option.value === value ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : null}
                </div>
                {showColorDot && option.color && (
                  <div 
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" 
                    style={{ backgroundColor: option.color }} 
                  />
                )}
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone board multi-select button for use outside the filter popover
export function BoardMultiSelectButton({ 
  teamId, 
  selected, 
  onChange 
}: { 
  teamId: string | null; 
  selected: string[]; 
  onChange: (boards: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: boards } = useBoards(teamId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllSelected = selected.length === 0;

  const toggleBoard = (boardId: string) => {
    if (selected.includes(boardId)) {
      onChange(selected.filter(id => id !== boardId));
    } else {
      onChange([...selected, boardId]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const displayText = isAllSelected
    ? "Quadros"
    : selected.length === 1
      ? boards?.find(b => b.id === selected[0])?.name || "1 quadro"
      : `${selected.length} quadros`;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant={!isAllSelected ? "default" : "outline"}
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline truncate max-w-[120px]">{displayText}</span>
        {!isAllSelected && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 justify-center bg-background text-foreground">
            {selected.length}
          </Badge>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-[260px] rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {/* "Todos" option */}
            <button
              type="button"
              onClick={selectAll}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition-colors hover:bg-accent ${
                isAllSelected ? "bg-accent/50 font-medium" : ""
              }`}
            >
              <div className="flex h-4 w-4 items-center justify-center shrink-0">
                {isAllSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <span>Todos os quadros</span>
            </button>
            {/* Board options */}
            {boards?.map((board) => {
              const isSelected = selected.includes(board.id);
              return (
                <button
                  key={board.id}
                  type="button"
                  title={board.name}
                  onClick={() => toggleBoard(board.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition-colors hover:bg-accent ${
                    isSelected ? "bg-accent/50 font-medium" : ""
                  }`}
                >
                  <div className="flex h-4 w-4 items-center justify-center shrink-0">
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <span className="truncate">{board.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface AssigneeSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  members: Array<{ user_id: string; profile?: { full_name: string; avatar_url?: string | null } | null }> | undefined;
}

function AssigneeSelect({ value, onChange, members }: AssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedMember = members?.find(m => m.user_id === value);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background/50 px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      >
        <span className={`flex items-center gap-2 ${selectedMember ? "text-foreground" : "text-muted-foreground"}`}>
          {selectedMember && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={selectedMember.profile?.avatar_url || undefined} />
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                {getInitials(selectedMember.profile?.full_name || "?")}
              </AvatarFallback>
            </Avatar>
          )}
          {selectedMember?.profile?.full_name || "Todos"}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                !value ? "bg-accent/50 font-medium" : ""
              }`}
            >
              <div className="flex h-4 w-4 items-center justify-center">
                {!value && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <span>Todos</span>
            </button>
            {members?.map((member) => (
              <button
                key={member.user_id}
                type="button"
                onClick={() => {
                  onChange(member.user_id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                  member.user_id === value ? "bg-accent/50 font-medium" : ""
                }`}
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  {member.user_id === value && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {getInitials(member.profile?.full_name || "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{member.profile?.full_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Exported component for selected board chips shown outside the popover
export function SelectedBoardChips({ 
  boards, 
  selectedIds, 
  onRemove 
}: { 
  boards: Array<{ id: string; name: string }> | undefined;
  selectedIds: string[];
  onRemove: (id: string) => void;
}) {
  if (!selectedIds.length || !boards) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {selectedIds.map(id => {
        const board = boards.find(b => b.id === id);
        if (!board) return null;
        return (
          <TooltipProvider key={id} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal max-w-[180px] cursor-default bg-primary/10 border-primary/20 text-foreground hover:bg-primary/15"
                >
                  <LayoutGrid className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{board.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(id);
                    }}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{board.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

export function TeamDemandsFilters({ teamId, filters, onChange }: TeamDemandsFiltersProps) {
  const [open, setOpen] = useState(false);
  const { data: services } = useServices(teamId, null);
  const { data: positions } = useTeamPositions(teamId);
  const { data: members } = useTeamMembers(teamId);

  // Count active filters excluding status
  const activeFiltersCount = Object.entries(filters)
    .filter(([key, value]) => {
      if (key === 'status') return false;
      if (key === 'boards') return false; // boards are outside the popup now
      return Boolean(value);
    })
    .length;

  // Persist position filter to localStorage
  useEffect(() => {
    if (filters.position) {
      localStorage.setItem(POSITION_FILTER_KEY, filters.position);
    } else {
      localStorage.removeItem(POSITION_FILTER_KEY);
    }
  }, [filters.position]);

  const clearFilters = () => {
    onChange({
      status: null,
      priority: null,
      assignee: null,
      service: null,
      dueDateFrom: null,
      dueDateTo: null,
      position: null,
      boards: [],
    });
  };

  const updateFilter = <K extends keyof TeamDemandsFiltersState>(
    key: K,
    value: TeamDemandsFiltersState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const priorityOptions = [
    { value: "all", label: "Todas" },
    { value: "baixa", label: "Baixa" },
    { value: "média", label: "Média" },
    { value: "alta", label: "Alta" },
  ];

  const serviceOptions = [
    { value: "all", label: "Todos" },
    ...(services?.map(s => ({ value: s.id, label: s.name })) || [])
  ];

  const positionOptions = [
    { value: "all", label: "Todos" },
    ...(positions?.map(p => ({ value: p.id, label: p.name, color: p.color })) || [])
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={activeFiltersCount > 0 ? "default" : "outline"} 
          size="sm" 
          className="relative gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge 
              variant="secondary" 
              className="h-5 min-w-5 px-1.5 justify-center bg-background text-foreground"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start" sideOffset={8}>
        <div className="border-b border-border bg-muted/30 px-4 py-3 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filtros</h4>
            {activeFiltersCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Row 1: Priority + Service */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide h-4 flex items-center">Prioridade</label>
              <NativeSelect
                value={filters.priority}
                onChange={(v) => updateFilter("priority", v)}
                options={priorityOptions}
                placeholder="Todas"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide h-4 flex items-center">Serviço</label>
              <NativeSelect
                value={filters.service}
                onChange={(v) => updateFilter("service", v)}
                options={serviceOptions}
                placeholder="Todos"
              />
            </div>
          </div>

          {/* Row 2: Position + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            {positions && positions.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide h-4 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Cargo
                </label>
                <NativeSelect
                  value={filters.position}
                  onChange={(v) => updateFilter("position", v)}
                  options={positionOptions}
                  placeholder="Todos"
                  showColorDot
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide h-4 flex items-center">Responsável</label>
              <AssigneeSelect
                value={filters.assignee}
                onChange={(v) => updateFilter("assignee", v)}
                members={members}
              />
            </div>
          </div>



          {/* Row 4: Due date range */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide h-4 flex items-center">Vencimento</label>
            <div className="grid grid-cols-2 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`w-full justify-start h-8 rounded-lg bg-background/50 hover:bg-accent/50 text-xs px-3 ${
                      filters.dueDateFrom ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {filters.dueDateFrom
                      ? format(filters.dueDateFrom, "dd/MM/yyyy", { locale: ptBR })
                      : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" side="bottom" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dueDateFrom || undefined}
                    onSelect={(d) => updateFilter("dueDateFrom", d || null)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`w-full justify-start h-8 rounded-lg bg-background/50 hover:bg-accent/50 text-xs px-3 ${
                      filters.dueDateTo ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {filters.dueDateTo
                      ? format(filters.dueDateTo, "dd/MM/yyyy", { locale: ptBR })
                      : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" side="bottom" align="end">
                  <Calendar
                    mode="single"
                    selected={filters.dueDateTo || undefined}
                    onSelect={(d) => updateFilter("dueDateTo", d || null)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}