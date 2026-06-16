import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Filter, X, CalendarIcon, ChevronDown, Check, Briefcase, Layers } from "lucide-react";
import { useDemandStatuses } from "@/hooks/useDemands";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { useServices } from "@/hooks/useServices";
import { useBoards } from "@/hooks/useBoards";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useTeamPositions } from "@/hooks/useTeamPositions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface DemandFiltersState {
  status: string | null;
  priority: string | null;
  assignee: string | null;
  service: string | null;
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
  position: string | null;
}

interface DemandFiltersProps {
  boardId: string | null;
  filters: DemandFiltersState;
  onChange: (filters: DemandFiltersState) => void;
  availableBoardIds?: string[];
}

interface NativeSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string; color?: string }[];
  placeholder: string;
  showColorDot?: boolean;
}

function NativeSelect({ value, onChange, options, placeholder, showColorDot }: NativeSelectProps) {
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

export function DemandFilters({ boardId, filters, onChange, availableBoardIds }: DemandFiltersProps) {
  const [open, setOpen] = useState(false);
  const { currentTeamId, selectedBoardId, setSelectedBoardId } = useSelectedBoard();
  const { data: allBoards } = useBoards(currentTeamId);
  const boards = availableBoardIds && allBoards
    ? allBoards.filter(b => availableBoardIds.includes(b.id))
    : allBoards;
  const { data: statuses } = useDemandStatuses();
  const { data: members } = useBoardMembers(boardId);
  const { data: services } = useServices(currentTeamId, boardId);
  const { data: positions } = useTeamPositions(currentTeamId);

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  const clearFilters = () => {
    onChange({
      status: null,
      priority: null,
      assignee: null,
      service: null,
      dueDateFrom: null,
      dueDateTo: null,
      position: null,
    });
  };

  const updateFilter = <K extends keyof DemandFiltersState>(
    key: K,
    value: DemandFiltersState[K]
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
        <button 
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8
            transition-all duration-200 whitespace-nowrap
            ${activeFiltersCount > 0 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "bg-background border border-border/60 hover:border-primary/40 hover:text-primary"
            }
          `}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 flex flex-col" align="start" side="bottom" avoidCollisions style={{ maxHeight: 'min(480px, calc(100vh - 200px))' }}>
        <div className="border-b border-border bg-muted/30 px-4 py-3 rounded-t-lg shrink-0">
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
                Limpar tudo
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Board selector - mobile only */}
          {boards && boards.length > 1 && (
            <div className="space-y-1.5 lg:hidden">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Layers className="h-3 w-3" /> Quadro
              </label>
              <NativeSelect
                value={selectedBoardId}
                onChange={(v) => setSelectedBoardId(v === "all" ? null : v)}
                options={[
                  { value: "all", label: "Todos os quadros" },
                  ...boards.map(b => ({ value: b.id, label: b.name }))
                ]}
                placeholder="Todos os quadros"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prioridade</label>
            <NativeSelect
              value={filters.priority}
              onChange={(v) => updateFilter("priority", v)}
              options={priorityOptions}
              placeholder="Todas"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável</label>
            <AssigneeSelect
              value={filters.assignee}
              onChange={(v) => updateFilter("assignee", v)}
              members={members}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Serviço</label>
              <NativeSelect
                value={filters.service}
                onChange={(v) => updateFilter("service", v)}
                options={serviceOptions}
                placeholder="Todos"
              />
            </div>

            {positions && positions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data de vencimento</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`flex-1 justify-start h-8 rounded-lg bg-background/50 hover:bg-accent/50 ${
                      filters.dueDateFrom ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {filters.dueDateFrom
                      ? format(filters.dueDateFrom, "dd/MM/yy", { locale: ptBR })
                      : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
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
                    className={`flex-1 justify-start h-8 rounded-lg bg-background/50 hover:bg-accent/50 ${
                      filters.dueDateTo ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {filters.dueDateTo
                      ? format(filters.dueDateTo, "dd/MM/yy", { locale: ptBR })
                      : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
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
