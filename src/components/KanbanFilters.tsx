import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X, User, Flag, Clock, Briefcase, ChevronDown, Check, Wrench } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useTeamPositions } from "@/hooks/useTeamPositions";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { useHierarchicalServices } from "@/hooks/useServices";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface KanbanFiltersState {
  myTasks: boolean;
  priority: string | null;
  dueDate: "overdue" | "today" | "week" | null;
  position: string | null;
  assignee: string | null;
  service: string | null;
}

interface KanbanFiltersProps {
  teamId: string | null;
  boardId?: string | null;
  filters: KanbanFiltersState;
  onChange: (filters: KanbanFiltersState) => void;
}

interface NativeSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string; color?: string; icon?: React.ReactNode }[];
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
          {selectedOption?.icon}
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
        <div className="absolute z-[60] mt-1.5 w-full rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="max-h-48 overflow-y-auto">
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
                {option.icon}
                {showColorDot && option.color && (
                  <div 
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" 
                    style={{ backgroundColor: option.color }} 
                  />
                )}
                <span className="truncate" title={option.label.trim()}>{option.label}</span>
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
        <div className="absolute z-[60] mt-1.5 w-full rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="max-h-48 overflow-y-auto">
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

export function KanbanFilters({ teamId, boardId, filters, onChange }: KanbanFiltersProps) {
  const { user } = useAuth();
  const { data: positions } = useTeamPositions(teamId);
  const { data: members } = useBoardMembers(boardId || null);
  const { data: hierarchicalServices, rawServices: services } = useHierarchicalServices(teamId, boardId);
  
  const activeFiltersCount = 
    (filters.myTasks ? 1 : 0) + 
    (filters.priority ? 1 : 0) + 
    (filters.dueDate ? 1 : 0) +
    (filters.position ? 1 : 0) +
    (filters.assignee ? 1 : 0) +
    (filters.service ? 1 : 0);

  const clearFilters = () => {
    onChange({ myTasks: false, priority: null, dueDate: null, position: null, assignee: null, service: null });
  };

  const priorityOptions = [
    { value: "all", label: "Todas" },
    { value: "baixa", label: "Baixa" },
    { value: "média", label: "Média" },
    { value: "alta", label: "Alta" },
  ];

  const dueDateOptions = [
    { value: "all", label: "Todos" },
    { value: "overdue", label: "Vencidos", icon: <div className="w-2 h-2 rounded-full bg-destructive" /> },
    { value: "today", label: "Hoje", icon: <div className="w-2 h-2 rounded-full bg-yellow-500" /> },
    { value: "week", label: "Esta semana", icon: <div className="w-2 h-2 rounded-full bg-blue-500" /> },
  ];

  const serviceOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "all", label: "Todos" }];
    if (!hierarchicalServices) return opts;
    
    hierarchicalServices.forEach(service => {
      opts.push({ value: service.id, label: service.name });
      if (service.isCategory) {
        service.children.forEach(child => {
          opts.push({ value: child.id, label: `  ${child.name}` });
        });
      }
    });
    return opts;
  }, [hierarchicalServices]);

  const positionOptions = [
    { value: "all", label: "Todos" },
    ...(positions?.map(p => ({ value: p.id, label: p.name, color: p.color })) || [])
  ];

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={filters.myTasks ? "default" : "outline"}
        size="sm"
        onClick={() => onChange({ ...filters, myTasks: !filters.myTasks })}
        className="gap-2"
      >
        <User className="h-4 w-4" />
        Minhas
      </Button>

      <Popover>
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
        <PopoverContent 
          className="w-[320px] p-0 flex flex-col" 
          align="end" 
          side="bottom" 
          avoidCollisions
          style={{ maxHeight: 'min(480px, calc(100vh - 200px))' }}
        >
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
                  Limpar
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Flag className="h-3 w-3" /> Prioridade
              </label>
              <NativeSelect
                value={filters.priority}
                onChange={(v) => onChange({ ...filters, priority: v })}
                options={priorityOptions}
                placeholder="Todas"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Vencimento
              </label>
              <NativeSelect
                value={filters.dueDate}
                onChange={(v) => onChange({ ...filters, dueDate: v as KanbanFiltersState["dueDate"] })}
                options={dueDateOptions}
                placeholder="Todos"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3 w-3" /> Responsável
              </label>
              <AssigneeSelect
                value={filters.assignee}
                onChange={(v) => onChange({ ...filters, assignee: v })}
                members={members}
              />
            </div>

            {services && services.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench className="h-3 w-3" /> Serviço
                </label>
                <NativeSelect
                  value={filters.service}
                  onChange={(v) => onChange({ ...filters, service: v })}
                  options={serviceOptions}
                  placeholder="Todos"
                />
              </div>
            )}

            {positions && positions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" /> Cargo
                </label>
                <NativeSelect
                  value={filters.position}
                  onChange={(v) => onChange({ ...filters, position: v })}
                  options={positionOptions}
                  placeholder="Todos"
                  showColorDot
                />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
