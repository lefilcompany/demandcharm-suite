import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemandCard } from "@/components/DemandCard";
import { useAllTeamDemands } from "@/hooks/useAllTeamDemands";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useMembersByPosition } from "@/hooks/useMembersByPosition";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useBoards } from "@/hooks/useBoards";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { 
  Layers, 
  LayoutGrid, 
  List, 
  Search, 
  Eye, 
  EyeOff, 
  CalendarDays, 
  ShieldAlert,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DataTable } from "@/components/ui/data-table";
import { teamDemandColumns, TeamDemandTableRow } from "@/components/team-demands/columns";
import { TeamDemandsFilters, TeamDemandsFiltersState, SelectedBoardChips, BoardMultiSelectButton } from "@/components/TeamDemandsFilters";
import { StatusFilterTabs, DELIVERED_LATE_FILTER_ID } from "@/components/StatusFilterTabs";
import { isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { DemandsCalendarView } from "@/components/DemandsCalendarView";
import { isDateOverdue } from "@/lib/dateUtils";
import { InfoTooltip } from "@/components/InfoTooltip";
import { SEOHead } from "@/components/SEOHead";
import { safeDateTimestamp, safeIncludesText } from "@/lib/demandViewSafety";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type ViewMode = "table" | "grid" | "calendar";

const TABLET_BREAKPOINT = 1024;
const POSITION_FILTER_KEY = "teamDemandsPositionFilter";
// sessionStorage keys — persist filters until the browser session ends
// (i.e., until the user fully closes the tab/browser or logs out)
const SESSION_STATE_PREFIX = "teamDemandsState:";

interface PersistedState {
  searchQuery: string;
  viewMode: ViewMode;
  hideDelivered: boolean;
  selectedStatuses?: string[];
  filters: {
    status: string | null;
    priority: string | null;
    assignee: string | null;
    service: string | null;
    dueDateFrom: string | null;
    dueDateTo: string | null;
    position: string | null;
    boards: string[];
  };
}

function getSessionKey(teamId: string | null) {
  return `${SESSION_STATE_PREFIX}${teamId ?? "none"}`;
}

function loadPersistedState(teamId: string | null): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(getSessionKey(teamId));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export default function TeamDemands() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedTeamId, currentTeam } = useSelectedTeam();
  const { data: role, isLoading: isRoleLoading } = useTeamRole(selectedTeamId);
  const isTeamAdminOrModerator = role === "owner";
  const { data: demands, isLoading } = useAllTeamDemands(selectedTeamId);
  const { data: boards } = useBoards(selectedTeamId);

  // Load persisted state for current team (session-scoped)
  const persisted = loadPersistedState(selectedTeamId);

  const [searchQuery, setSearchQuery] = useState<string>(() => persisted?.searchQuery ?? "");

  // Initialize viewMode from location state, then session, then default to "table"
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stateViewMode = (location.state as { viewMode?: ViewMode })?.viewMode;
    return stateViewMode || persisted?.viewMode || "table";
  });

  // Initialize filters from session (preferred) or localStorage (legacy position only)
  const [filters, setFilters] = useState<TeamDemandsFiltersState>(() => {
    if (persisted?.filters) {
      const f = persisted.filters;
      return {
        status: f.status,
        priority: f.priority,
        assignee: f.assignee,
        service: f.service,
        dueDateFrom: f.dueDateFrom ? new Date(f.dueDateFrom) : null,
        dueDateTo: f.dueDateTo ? new Date(f.dueDateTo) : null,
        position: f.position,
        boards: Array.isArray(f.boards) ? f.boards : [],
      };
    }
    const savedPosition = localStorage.getItem(POSITION_FILTER_KEY);
    return {
      status: null,
      priority: null,
      assignee: null,
      service: null,
      dueDateFrom: null,
      dueDateTo: null,
      position: savedPosition,
      boards: [],
    };
  });

  const [hideDelivered, setHideDelivered] = useState<boolean>(() => persisted?.hideDelivered ?? false);

  // Multi-select status (overrides single filters.status when non-empty)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    if (Array.isArray(persisted?.selectedStatuses)) return persisted!.selectedStatuses!;
    if (persisted?.filters?.status) return [persisted.filters.status];
    return [];
  });

  // Persist state to sessionStorage whenever it changes (scoped per team)
  useEffect(() => {
    if (!selectedTeamId) return;
    try {
      const payload: PersistedState = {
        searchQuery,
        viewMode,
        hideDelivered,
        selectedStatuses,
        filters: {
          status: filters.status,
          priority: filters.priority,
          assignee: filters.assignee,
          service: filters.service,
          dueDateFrom: filters.dueDateFrom ? filters.dueDateFrom.toISOString() : null,
          dueDateTo: filters.dueDateTo ? filters.dueDateTo.toISOString() : null,
          position: filters.position,
          boards: filters.boards,
        },
      };
      sessionStorage.setItem(getSessionKey(selectedTeamId), JSON.stringify(payload));
    } catch {
      // ignore quota / serialization errors
    }
  }, [selectedTeamId, searchQuery, viewMode, hideDelivered, selectedStatuses, filters]);

  // When team changes, reload persisted state for that team
  useEffect(() => {
    const p = loadPersistedState(selectedTeamId);
    if (!p) return;
    setSearchQuery(p.searchQuery ?? "");
    setViewMode(p.viewMode ?? "table");
    setHideDelivered(p.hideDelivered ?? false);
    setSelectedStatuses(
      Array.isArray(p.selectedStatuses)
        ? p.selectedStatuses
        : p.filters?.status
        ? [p.filters.status]
        : []
    );
    setFilters({
      status: p.filters.status,
      priority: p.filters.priority,
      assignee: p.filters.assignee,
      service: p.filters.service,
      dueDateFrom: p.filters.dueDateFrom ? new Date(p.filters.dueDateFrom) : null,
      dueDateTo: p.filters.dueDateTo ? new Date(p.filters.dueDateTo) : null,
      position: p.filters.position,
      boards: Array.isArray(p.filters.boards) ? p.filters.boards : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);
  
  
  
  // Fetch members with selected position for filtering
  const { data: membersByPosition } = useMembersByPosition(selectedTeamId, filters.position);
  
  // Detect if screen is mobile or tablet (< 1024px)
  const [isTabletOrSmaller, setIsTabletOrSmaller] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      setIsTabletOrSmaller(window.innerWidth < TABLET_BREAKPOINT);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);
  
  // Force grid view on mobile/tablet (screens < 1024px), but allow calendar on all devices
  const effectiveViewMode = isTabletOrSmaller && viewMode !== "calendar" ? "grid" : viewMode;

  // Statistics based on all filters (excluding hideDelivered and status, which are view-level)
  const stats = useMemo(() => {
    if (!demands) return { total: 0, inProgress: 0, delivered: 0, overdue: 0 };

    // Apply all filters except status and hideDelivered
    const source = demands.filter((d) => {
      if (filters.boards.length > 0 && !filters.boards.includes(d.board_id)) return false;
      if (filters.priority && d.priority !== filters.priority) return false;
      if (filters.assignee) {
        const isAssigned = d.demand_assignees?.some(a => a.user_id === filters.assignee) || d.assigned_to === filters.assignee;
        if (!isAssigned) return false;
      }
      if (filters.service && d.service_id !== filters.service) return false;
      if (filters.position && membersByPosition) {
        const has = d.demand_assignees?.some(a => membersByPosition.includes(a.user_id)) || (d.assigned_to && membersByPosition.includes(d.assigned_to));
        if (!has) return false;
      }
      if (d.due_date) {
        const dueDate = new Date(d.due_date);
        if (filters.dueDateFrom && isBefore(dueDate, startOfDay(filters.dueDateFrom))) return false;
        if (filters.dueDateTo && isAfter(dueDate, endOfDay(filters.dueDateTo))) return false;
      } else if (filters.dueDateFrom || filters.dueDateTo) {
        return false;
      }
      return true;
    });

    const total = source.length;
    const inProgress = source.filter(d => d.demand_statuses?.name === "Fazendo").length;
    const delivered = source.filter(d => d.demand_statuses?.name === "Entregue").length;
    const overdue = source.filter(d => {
      if (!d.due_date) return false;
      // Demandas entregues não são consideradas atrasadas
      if (d.demand_statuses?.name === "Entregue" || d.delivered_at) return false;
      return isDateOverdue(d.due_date);
    }).length;

    return { total, inProgress, delivered, overdue };
  }, [demands, filters, membersByPosition]);

  const hasAnyFilter = filters.boards.length > 0 || filters.priority || filters.assignee || filters.service || filters.position || filters.dueDateFrom || filters.dueDateTo;
  const hasBoardFilter = filters.boards.length > 0;
  const selectedBoardNames = useMemo(() => {
    if (!hasBoardFilter || !boards) return "";
    const names = filters.boards
      .map(id => boards.find(b => b.id === id)?.name)
      .filter(Boolean);
    if (names.length === 1) return names[0]!;
    return `${names.length} quadros`;
  }, [filters.boards, boards, hasBoardFilter]);

  const filteredDemands = useMemo(() => {
    if (!demands) return [];
    
    const filtered = demands.filter((d) => {
      // Hide delivered filter
      if (hideDelivered && d.demand_statuses?.name === "Entregue") {
        return false;
      }
      
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          safeIncludesText(d.title, query) ||
          safeIncludesText(d.description, query) ||
          safeIncludesText(d.priority, query);
        if (!matchesSearch) return false;
      }
      
      // Status filter (multi-select takes precedence; falls back to single status)
      if (selectedStatuses.length > 0) {
        const isDelivered = d.demand_statuses?.name === "Entregue" || !!d.delivered_at;
        const isDeliveredLate = isDelivered && d.is_overdue === true;
        const wantsLate = selectedStatuses.includes(DELIVERED_LATE_FILTER_ID);
        const realStatusIds = selectedStatuses.filter(s => s !== DELIVERED_LATE_FILTER_ID);
        const matchesStatus = realStatusIds.includes(d.status_id);
        const matchesLate = wantsLate && isDeliveredLate;
        if (!matchesStatus && !matchesLate) return false;
      } else if (filters.status && d.status_id !== filters.status) {
        return false;
      }
      
      // Priority filter
      if (filters.priority && d.priority !== filters.priority) {
        return false;
      }
      
      // Board filter (multi-select)
      if (filters.boards.length > 0 && !filters.boards.includes(d.board_id)) {
        return false;
      }
      
      // Assignee filter
      if (filters.assignee) {
        const isAssigned = d.demand_assignees?.some(
          (a) => a.user_id === filters.assignee
        ) || d.assigned_to === filters.assignee;
        if (!isAssigned) return false;
      }
      
      // Service filter
      if (filters.service && d.service_id !== filters.service) {
        return false;
      }
      
      // Position filter - filter by members with selected position
      if (filters.position && membersByPosition) {
        const hasAssigneeWithPosition = d.demand_assignees?.some(
          (a) => membersByPosition.includes(a.user_id)
        ) || (d.assigned_to && membersByPosition.includes(d.assigned_to));
        if (!hasAssigneeWithPosition) return false;
      }
      
      // Due date range filter
      if (d.due_date) {
        const dueDate = new Date(d.due_date);
        if (filters.dueDateFrom && isBefore(dueDate, startOfDay(filters.dueDateFrom))) {
          return false;
        }
        if (filters.dueDateTo && isAfter(dueDate, endOfDay(filters.dueDateTo))) {
          return false;
        }
      } else if (filters.dueDateFrom || filters.dueDateTo) {
        return false;
      }
      
      return true;
    });
    
    // Sort by due date: closest to current date first, no due date at the end
    return filtered.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      
      const dateA = safeDateTimestamp(a.due_date);
      const dateB = safeDateTimestamp(b.due_date);
      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return dateA - dateB;
    });
  }, [demands, searchQuery, filters, selectedStatuses, hideDelivered, membersByPosition]);

  const renderDemandList = (demandList: typeof filteredDemands) => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground mt-4">{t("common.loading")}</p>
        </div>
      );
    }

    if (demandList.length === 0 && effectiveViewMode !== "calendar") {
      if (searchQuery) {
        return (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
            <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
            <Search className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {t("common.noResults")}
            </h3>
            <p className="text-muted-foreground mt-2">
              Tente ajustar os filtros ou a busca
            </p>
          </div>
        );
      }
      return (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
          <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
          <Layers className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Nenhuma demanda encontrada
          </h3>
          <p className="text-muted-foreground mt-2">
            Não há demandas nos quadros desta equipe
          </p>
        </div>
      );
    }


    if (effectiveViewMode === "calendar") {
      return (
        <DemandsCalendarView
          demands={demandList}
          onDemandClick={(demandId) => navigate(`/demands/${demandId}`, { state: { from: "team-demands", viewMode: "calendar" } })}
          onDayClick={() => {}}
          isRequester={false}
        />
      );
    }

    if (effectiveViewMode === "table") {
      return (
        <Card className="border-border/50 shadow-sm">
          <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
          <CardContent className="p-0">
            <DataTable
              columns={teamDemandColumns}
              data={demandList as unknown as TeamDemandTableRow[]}
              onRowClick={(row) => navigate(`/demands/${row.id}`, { state: { from: "team-demands", viewMode: "table" } })}
              defaultSorting={[{ id: "due_date", desc: false }]}
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
        {demandList.map((demand) => (
          <DemandCard
            key={demand.id}
            demand={demand}
            onClick={() => navigate(`/demands/${demand.id}`, { state: { from: "team-demands", viewMode: "grid" } })}
            showFullDetails
          />
        ))}
      </div>
    );
  };

  // Loading state
  if (isRoleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground mt-4">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // No team selected
  if (!selectedTeamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Selecione uma equipe
            </h3>
            <p className="text-muted-foreground">
              Escolha uma equipe para ver todas as demandas
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Visão Geral - Demandas" path="/team-demands" />
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Visão Geral
            </h1>
            <p className="text-sm text-muted-foreground">
              {isTeamAdminOrModerator 
                ? (currentTeam?.name ? `Equipe ${currentTeam.name}` : "Todas as demandas")
                : "Demandas dos quadros que você participa"
              } • {boards?.length || 0} quadros
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="space-y-2">
        {hasAnyFilter && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span>
              Dados filtrados
              {hasBoardFilter && <> • <span className="font-medium text-foreground">{selectedBoardNames}</span></>}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">Total</p>
                    <InfoTooltip text="Número total de demandas ativas nos quadros da equipe, considerando os filtros aplicados." />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">Em Andamento</p>
                    <InfoTooltip text="Demandas que estão atualmente sendo executadas (status 'Fazendo')." />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{stats.delivered}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">Entregues</p>
                    <InfoTooltip text="Demandas que foram concluídas e entregues com sucesso (status 'Entregue')." />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-border/50 ${stats.overdue > 0 ? "border-destructive/30 bg-destructive/5" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${stats.overdue > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-destructive" : "text-foreground"}`}>{stats.overdue}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground truncate">Atrasadas</p>
                    <InfoTooltip text="Demandas cuja data de entrega já passou e que ainda não foram entregues. Demandas já entregues não são contabilizadas." />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters and Actions */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="relative w-full lg:w-[280px] lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
           <div className="flex items-center gap-2 flex-wrap lg:ml-auto">
              <BoardMultiSelectButton
                teamId={selectedTeamId}
                selected={filters.boards}
                onChange={(boards) => setFilters({ ...filters, boards })}
              />
              {isTeamAdminOrModerator ? (
                <TeamDemandsFilters 
                  teamId={selectedTeamId} 
                  filters={filters} 
                  onChange={setFilters} 
                />
              ) : (
                <Select
                  value={filters.priority || "all"}
                  onValueChange={(v) => setFilters({ ...filters, priority: v === "all" ? null : v })}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="média">Média</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {/* Toggle hide/show delivered */}
              {stats.delivered > 0 && (
                <Button 
                  variant={hideDelivered ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHideDelivered(!hideDelivered)}
                  className="gap-2"
                >
                  {hideDelivered ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {hideDelivered ? "Exibir" : "Ocultar"} Entregues
                  </span>
                  <Badge variant="secondary" className="ml-0.5 h-5 px-1.5">
                    {stats.delivered}
                  </Badge>
                </Button>
              )}
              
              {/* View toggle */}
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`hidden lg:flex rounded-none h-8 w-8 ${viewMode === "table" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Visualização em tabela"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`hidden lg:flex rounded-none h-8 w-8 ${viewMode === "grid" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Visualização em blocos"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-none h-8 w-8 ${viewMode === "calendar" ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                  onClick={() => setViewMode("calendar")}
                  title="Visualização em calendário"
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Selected board chips */}
          {filters.boards.length > 0 && (
            <SelectedBoardChips
              boards={boards}
              selectedIds={filters.boards}
              onRemove={(id) => setFilters({ ...filters, boards: filters.boards.filter(b => b !== id) })}
            />
          )}

          {/* Active filters indicator */}
          {filteredDemands.length !== stats.total && (
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">{filteredDemands.length}</span> de {stats.total} demandas
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 -mb-2">
        <StatusFilterTabs
          values={selectedStatuses}
          onValuesChange={setSelectedStatuses}
          multiSelect
        />
      </div>

      {/* Content */}
      {renderDemandList(filteredDemands)}
    </div>
  );
}
