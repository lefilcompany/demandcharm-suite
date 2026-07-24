import { useState, useMemo, useEffect } from "react";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { DemandFolderStrip } from "@/components/DemandFolderStrip";
import { useFolderDemandIds } from "@/hooks/useDemandFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useDemands, useUpdateDemand } from "@/hooks/useDemands";
import { useAllTeamDemands } from "@/hooks/useAllTeamDemands";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useAuth } from "@/lib/auth";
import { useMembersByPosition } from "@/hooks/useMembersByPosition";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Plus, Briefcase, LayoutList, LayoutGrid, List, Search, Eye, EyeOff, CalendarDays, User, Layers, Archive, RotateCcw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DemandHierarchyTable, HierarchicalDemand } from "@/components/demands/DemandHierarchyTable";
import { DemandHierarchyGrid } from "@/components/demands/DemandHierarchyGrid";
import { DemandFilters, DemandFiltersState } from "@/components/DemandFilters";
import { StatusFilterTabs, DELIVERED_LATE_FILTER_ID } from "@/components/StatusFilterTabs";
import { isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useRealtimeDemands } from "@/hooks/useRealtimeDemands";
import { DemandsCalendarView } from "@/components/DemandsCalendarView";
import { CreateDemandQuickDialog } from "@/components/CreateDemandQuickDialog";
import { CreateRequestQuickDialog } from "@/components/CreateRequestQuickDialog";
import { useDemandAssignees } from "@/hooks/useDemandAssignees";
import { ScheduledDemandsModal } from "@/components/ScheduledDemandsModal";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";
import { useTeamMembershipRole } from "@/hooks/useTeamRole";
import { ArchivedDemandsModal } from "@/components/ArchivedDemandsModal";
import { SEOHead } from "@/components/SEOHead";
import { safeDateTimestamp, safeIncludesText } from "@/lib/demandViewSafety";
type ViewMode = "table" | "grid" | "calendar";
const TABLET_BREAKPOINT = 1024;

const DEMANDS_FILTERS_LS_KEY = "soma:demands-filters:v1";

const DEFAULT_FILTERS: DemandFiltersState = {
  status: null,
  priority: null,
  assignee: null,
  service: null,
  dueDateFrom: null,
  dueDateTo: null,
  position: null,
};

type PersistedDemandsState = {
  searchQuery: string;
  viewMode: ViewMode;
  filters: DemandFiltersState;
  selectedStatuses: string[];
  hideDelivered: boolean;
  showOnlyMine: boolean;
  showAllBoards: boolean;
  selectedFolderId: string | null;
};

const DEFAULT_PERSISTED: PersistedDemandsState = {
  searchQuery: "",
  viewMode: "table",
  filters: DEFAULT_FILTERS,
  selectedStatuses: [],
  hideDelivered: false,
  showOnlyMine: false,
  showAllBoards: false,
  selectedFolderId: null,
};

function loadPersistedDemandsState(): PersistedDemandsState {
  if (typeof window === "undefined") return DEFAULT_PERSISTED;
  try {
    const raw = window.localStorage.getItem(DEMANDS_FILTERS_LS_KEY);
    if (!raw) return DEFAULT_PERSISTED;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PERSISTED,
      ...parsed,
      filters: {
        ...DEFAULT_FILTERS,
        ...(parsed.filters || {}),
        dueDateFrom: parsed?.filters?.dueDateFrom ? new Date(parsed.filters.dueDateFrom) : null,
        dueDateTo: parsed?.filters?.dueDateTo ? new Date(parsed.filters.dueDateTo) : null,
      },
    };
  } catch {
    return DEFAULT_PERSISTED;
  }
}

export default function Demands() {
  const {
    t
  } = useTranslation();
  const navigate = useNavigate();
  const { openCreateDemand } = useCreateDemandModal();
  const guardDemands = usePlanLimitGuard("demands");
  const location = useLocation();
  const {
    user
  } = useAuth();
  const {
    selectedBoardId,
    setSelectedBoardId,
    currentTeamId
  } = useSelectedBoard();

  const handleDemandClick = (demandId: string, boardId?: string, viewMode?: string) => {
    // If clicking a demand from a different board, switch to that board first
    if (boardId && boardId !== selectedBoardId) {
      setSelectedBoardId(boardId);
    }
    navigate(`/demands/${demandId}`, {
      state: {
        from: "demands",
        viewMode: viewMode || "table",
        calendarMonth: viewMode === "calendar" ? calendarMonth.toISOString() : undefined
      }
    });
  };
  const {
    data: demands,
    isLoading
  } = useDemands(selectedBoardId || undefined);
  const {
    data: role
  } = useBoardRole(selectedBoardId);
  const { data: teamMembershipRole } = useTeamMembershipRole(currentTeamId);

  // Enable realtime updates for demands
  useRealtimeDemands(selectedBoardId || undefined);

  // Load persisted filter state once
  const persisted = useMemo(() => loadPersistedDemandsState(), []);

  const [searchQuery, setSearchQuery] = useState(persisted.searchQuery);

  // Initialize viewMode from location state (priority) or persisted state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stateViewMode = (location.state as {
      viewMode?: ViewMode;
    })?.viewMode;
    return stateViewMode || persisted.viewMode;
  });

  // Track calendar month for persistence across navigation
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const stateMonth = (location.state as { calendarMonth?: string })?.calendarMonth;
    return stateMonth ? new Date(stateMonth) : new Date();
  });
  const [filters, setFilters] = useState<DemandFiltersState>(persisted.filters);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(persisted.selectedStatuses);
  const [hideDelivered, setHideDelivered] = useState(persisted.hideDelivered);
  const [showOnlyMine, setShowOnlyMine] = useState(persisted.showOnlyMine);
  const [showAllBoards, setShowAllBoards] = useState(persisted.showAllBoards);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(persisted.selectedFolderId);

  // Persist filter state to localStorage on any change
  useEffect(() => {
    try {
      const payload: PersistedDemandsState = {
        searchQuery,
        viewMode,
        filters: {
          ...filters,
          // Date objects serialize to ISO via JSON.stringify automatically
        },
        selectedStatuses,
        hideDelivered,
        showOnlyMine,
        showAllBoards,
        selectedFolderId,
      };
      window.localStorage.setItem(DEMANDS_FILTERS_LS_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota / serialization errors
    }
  }, [searchQuery, viewMode, filters, selectedStatuses, hideDelivered, showOnlyMine, showAllBoards, selectedFolderId]);

  // Detect if any filter / view differs from defaults
  const hasActiveFilters = useMemo(() => {
    if (searchQuery.trim() !== "") return true;
    if (viewMode !== DEFAULT_PERSISTED.viewMode) return true;
    if (selectedStatuses.length > 0) return true;
    if (hideDelivered) return true;
    if (showOnlyMine) return true;
    if (showAllBoards) return true;
    if (selectedFolderId) return true;
    const f = filters;
    if (f.status || f.priority || f.assignee || f.service || f.position || f.dueDateFrom || f.dueDateTo) return true;
    return false;
  }, [searchQuery, viewMode, selectedStatuses, hideDelivered, showOnlyMine, showAllBoards, selectedFolderId, filters]);

  const clearAllFilters = () => {
    setSearchQuery(DEFAULT_PERSISTED.searchQuery);
    setViewMode(DEFAULT_PERSISTED.viewMode);
    setFilters(DEFAULT_FILTERS);
    setSelectedStatuses([]);
    setHideDelivered(false);
    setShowOnlyMine(false);
    setShowAllBoards(false);
    setSelectedFolderId(null);
    try {
      window.localStorage.removeItem(DEMANDS_FILTERS_LS_KEY);
    } catch {
      // ignore
    }
  };


  // Fetch folder demand IDs for filtering
  const { data: folderDemandIds } = useFolderDemandIds(selectedFolderId);
  // Fetch all team demands when "all boards" mode is active
  const { data: allTeamDemands, isLoading: isLoadingAllTeam } = useAllTeamDemands(showAllBoards ? currentTeamId : null);

  // Active demands source based on toggle
  const activeDemands = showAllBoards ? allTeamDemands : demands;
  const activeIsLoading = showAllBoards ? isLoadingAllTeam : isLoading;

  // Fetch members with selected position for filtering
  const {
    data: membersByPosition
  } = useMembersByPosition(currentTeamId, filters.position);

  // Calendar quick create dialog
  const [selectedDateForCreate, setSelectedDateForCreate] = useState<Date | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

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
  const isReadOnly = role === "requester" || (!role && teamMembershipRole === "requester");

  // Count delivered demands
  const deliveredCount = useMemo(() => {
    if (!activeDemands) return 0;
    return activeDemands.filter((d: any) => d.demand_statuses?.name === "Entregue").length;
  }, [activeDemands]);

  // Count demands assigned to the current user
  const myDemandsCount = useMemo(() => {
    if (!activeDemands || !user?.id) return 0;
    return activeDemands.filter((d: any) => {
      const isAssigned = d.demand_assignees?.some((a: any) => a.user_id === user.id) || d.assigned_to === user.id;
      return isAssigned;
    }).length;
  }, [activeDemands, user?.id]);
  const filteredDemands = useMemo(() => {
    if (!activeDemands) return [];
    const filtered = (activeDemands as any[]).filter((d: any) => {
      // Folder filter
      if (selectedFolderId && folderDemandIds) {
        if (!folderDemandIds.includes(d.id)) return false;
      }

      // Show only my demands filter
      if (showOnlyMine && user?.id) {
        const isAssigned = d.demand_assignees?.some(a => a.user_id === user.id) || d.assigned_to === user.id;
        if (!isAssigned) return false;
      }

      // Hide delivered filter
      if (hideDelivered && d.demand_statuses?.name === "Entregue") {
        return false;
      }

      // Search query filter — title, description, priority, code (#123 / 123 / BOARD-123), service name, due date
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();

        // Code match: strip # and optional BOARD- prefix, keep trailing digits
        const codeQuery = query.replace(/^#/, "");
        const codeMatch = codeQuery.match(/(?:^|-)(\d+)$/);
        const seqNum = codeMatch ? parseInt(codeMatch[1], 10) : null;
        const matchesCode = seqNum !== null && Number(d.board_sequence_number) === seqNum;

        // Service name
        const serviceName = (d.services as any)?.name;
        const matchesService = safeIncludesText(serviceName, query);

        // Due date: match yyyy-MM-dd, dd/MM/yyyy, dd/MM (accepts - or / as separator)
        let matchesDueDate = false;
        if (typeof d.due_date === "string" && d.due_date) {
          const iso = d.due_date.substring(0, 10);
          const [y, m, day] = iso.split("-");
          const br = `${day}/${m}/${y}`;
          const brShort = `${day}/${m}`;
          const normalized = query.replace(/-/g, "/");
          matchesDueDate =
            iso.includes(query) ||
            br.includes(normalized) ||
            brShort.includes(normalized);
        }

        const matchesText =
          safeIncludesText(d.title, query) ||
          safeIncludesText(d.description, query) ||
          safeIncludesText(d.priority, query);

        if (!(matchesText || matchesCode || matchesService || matchesDueDate)) return false;
      }

      // Status filter (multi-select; sentinel "delivered late" = entregue + is_overdue)
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

      // Assignee filter
      if (filters.assignee) {
        const isAssigned = d.demand_assignees?.some(a => a.user_id === filters.assignee) || d.assigned_to === filters.assignee;
        if (!isAssigned) return false;
      }

      // Service filter
      if (filters.service && d.service_id !== filters.service) {
        return false;
      }

      // Position filter - filter by members with selected position
      if (filters.position && membersByPosition) {
        const hasAssigneeWithPosition = d.demand_assignees?.some(a => membersByPosition.includes(a.user_id)) || d.assigned_to && membersByPosition.includes(d.assigned_to);
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
        // If filtering by date but demand has no due date, exclude it
        return false;
      }
      return true;
    });

    // Sort by due date: closest to current date first, no due date at the end
    return filtered.sort((a, b) => {
      // If both have no due date, maintain original order
      if (!a.due_date && !b.due_date) return 0;
      // If only a has no due date, put it at the end
      if (!a.due_date) return 1;
      // If only b has no due date, put it at the end
      if (!b.due_date) return -1;

      // Both have due dates - sort by closest to now first
      const dateA = safeDateTimestamp(a.due_date);
      const dateB = safeDateTimestamp(b.due_date);
      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return dateA - dateB;
    });
  }, [activeDemands, searchQuery, filters, selectedStatuses, hideDelivered, showOnlyMine, user?.id, membersByPosition, selectedFolderId, folderDemandIds]);

  // Handle calendar day click — open the standard create demand modal with the chosen date pre-filled
  const handleDayClick = async (date: Date) => {
    if (isReadOnly) {
      const ok = await guardDemands();
      if (!ok) return;
      setSelectedDateForCreate(date);
      setIsCreateDialogOpen(true);
    } else {
      openCreateDemand({ initialDueDate: date });
    }
  };


  const updateDemand = useUpdateDemand();

  const handleDemandDateChange = async (demandId: string, newDate: Date) => {
    await updateDemand.mutateAsync({
      id: demandId,
      due_date: newDate.toISOString(),
    });
  };
  const renderDemandList = (demandList: typeof filteredDemands) => {
    if (activeIsLoading) {
      return <ListSkeleton rows={8} />;
    }
    if (demandList.length === 0 && effectiveViewMode !== "calendar") {
      if (searchQuery) {
        return <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <Search className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {t("common.noResults")}
            </h3>
            <p className="text-muted-foreground mt-2">
              {t("common.search")}
            </p>
          </div>;
      }
      return <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            {t("demands.noDemands")}
          </h3>
          <p className="text-muted-foreground mt-2">
            {isReadOnly ? t("common.noResults") : t("demands.createFirst")}
          </p>
          {!isReadOnly && <div className="mt-6">
              <Button onClick={() => openCreateDemand()}>
                <Plus className="mr-2 h-4 w-4" />
                {t("demands.createFirst")}
              </Button>
            </div>}
        </div>;
    }
    if (effectiveViewMode === "calendar") {
      return <DemandsCalendarView demands={demandList} onDemandClick={(demandId) => {
        const demand = demandList.find((d: any) => d.id === demandId);
        handleDemandClick(demandId, demand?.board_id, "calendar");
      }} onDayClick={handleDayClick} isRequester={isReadOnly} onDemandDateChange={handleDemandDateChange} initialDate={calendarMonth} onDateChange={setCalendarMonth} />;
    }
    if (effectiveViewMode === "table") {
      return <DemandHierarchyTable data={demandList as unknown as HierarchicalDemand[]} onRowClick={row => handleDemandClick(row.id, (row as any).board_id, "table")} />;
    }
    return <DemandHierarchyGrid data={demandList as any[]} onDemandClick={(demandId, boardId) => handleDemandClick(demandId, boardId, "grid")} />;
  };
  return <div className="space-y-4 md:space-y-6 animate-fade-in">
      <SEOHead title="Demandas" path="/demands" />
      <PageBreadcrumb
        items={[
          { label: t("demands.title"), icon: LayoutList, isCurrent: true },
        ]}
      />
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {t("demands.title")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {isReadOnly ? t("common.view") : t("common.actions")}
            </p>
          </div>
          
        </div>

        {/* Search and Filters Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por título, código (ex: 284), serviço ou data de vencimento…" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-10 h-10 bg-background"
            />
          </div>

          {/* Folder Strip */}
          <DemandFolderStrip
            teamId={currentTeamId}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
          />

          {/* Actions Toolbar */}
          <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-xl border border-border/50">
            {/* Left side: Filters and Quick Toggles */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {/* Filters Button */}
              <DemandFilters boardId={selectedBoardId} filters={filters} onChange={setFilters} />
              
              {/* All boards toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowAllBoards(!showAllBoards)}
                    className={`
                      inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8
                      transition-all duration-200 whitespace-nowrap
                      ${showAllBoards 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "bg-background border border-border/60 hover:border-primary/40 hover:text-primary"
                      }
                    `}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Todos os quadros</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{showAllBoards ? "Exibindo demandas de todos os quadros. Clique para ver apenas o quadro selecionado." : "Clique para ver demandas de todos os quadros ao mesmo tempo."}</TooltipContent>
              </Tooltip>

              {/* Scheduled demands button */}
              <ScheduledDemandsModal boardId={selectedBoardId} teamId={currentTeamId} />

              {/* Archived demands button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsArchivedOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8 transition-all duration-200 whitespace-nowrap bg-background border border-border/60 hover:border-primary/40 hover:text-primary"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Arquivadas</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Ver demandas que foram arquivadas e removidas da visualização principal.</TooltipContent>
              </Tooltip>
              
              {/* Quick toggle chips */}
              {!isReadOnly && myDemandsCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowOnlyMine(!showOnlyMine)}
                      className={`
                        inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8
                        transition-all duration-200 whitespace-nowrap
                        ${showOnlyMine 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "bg-background border border-border/60 hover:border-primary/40 hover:text-primary"
                        }
                      `}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Minhas</span>
                      <span className={`
                        inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 
                        rounded-full text-[10px] font-bold
                        ${showOnlyMine 
                          ? "bg-primary-foreground/20 text-primary-foreground" 
                          : "bg-primary/10 text-primary"
                        }
                      `}>
                        {myDemandsCount}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{showOnlyMine ? "Mostrando apenas suas demandas. Clique para ver todas." : "Filtrar para exibir apenas as demandas atribuídas a você."}</TooltipContent>
                </Tooltip>
              )}
              
              {deliveredCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setHideDelivered(!hideDelivered)}
                      className={`
                        inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8
                        transition-all duration-200 whitespace-nowrap
                        ${hideDelivered 
                          ? "bg-muted-foreground text-background shadow-sm" 
                          : "bg-background border border-border/60 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400"
                        }
                      `}
                    >
                      {hideDelivered ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{hideDelivered ? "Ocultas" : "Entregues"}</span>
                      <span className={`
                        inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 
                        rounded-full text-[10px] font-bold
                        ${hideDelivered 
                          ? "bg-background/20 text-background" 
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }
                      `}>
                        {deliveredCount}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{hideDelivered ? "Demandas entregues estão ocultas. Clique para exibi-las novamente." : "Ocultar demandas já entregues para focar nas pendentes."}</TooltipContent>
                </Tooltip>
              )}

              {/* Clear filters button — appears when any filter / view differs from default */}
              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={clearAllFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8 transition-all duration-200 whitespace-nowrap bg-background border border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Limpar filtros</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Restaurar filtros e visualização ao padrão.</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Right side: View toggle */}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <div className="flex items-center bg-background rounded-full border border-border/60 overflow-hidden">
                <button
                  onClick={() => setViewMode("table")}
                  className={`
                    hidden lg:flex items-center justify-center h-8 w-8 transition-all
                    ${viewMode === "table" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }
                  `}
                  title={t("demands.tableView")}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`
                    hidden lg:flex items-center justify-center h-8 w-8 transition-all
                    ${viewMode === "grid" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }
                  `}
                  title={t("demands.gridView")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`
                    flex items-center justify-center h-8 w-8 transition-all
                    ${viewMode === "calendar" 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }
                  `}
                  title="Visualização em calendário"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
              
            </div>
          </div>
        </div>
      </div>

      {/* Status filter tabs - Scrollable horizontally */}
      <div className="w-full overflow-x-auto -mx-1 px-1">
        <div className="min-w-max pb-1">
          <StatusFilterTabs
            values={selectedStatuses}
            onValuesChange={setSelectedStatuses}
            multiSelect
          />
        </div>
      </div>

      {!selectedBoardId && !showAllBoards ? <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            {t("teams.title")}
          </h3>
          <p className="text-muted-foreground mt-2">
            {t("common.noResults")}
          </p>
        </div> : renderDemandList(filteredDemands)}

      {/* Quick create dialog for calendar - show request dialog for requesters, demand dialog for others */}
      {isReadOnly ? <CreateRequestQuickDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} selectedDate={selectedDateForCreate} /> : <CreateDemandQuickDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} selectedDate={selectedDateForCreate} />}

      <ArchivedDemandsModal open={isArchivedOpen} onOpenChange={setIsArchivedOpen} isReadOnly={isReadOnly} />
    </div>;
}