import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemandCard } from "@/components/DemandCard";
import { useMyDemands } from "@/hooks/useMyDemands";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useBoards } from "@/hooks/useBoards";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { 
  User, 
  LayoutGrid, 
  List, 
  Search, 
  Eye, 
  EyeOff, 
  CalendarDays, 
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DataTable } from "@/components/ui/data-table";
import { teamDemandColumns, TeamDemandTableRow } from "@/components/team-demands/columns";
import { StatusFilterTabs } from "@/components/StatusFilterTabs";
import { isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { DemandsCalendarView } from "@/components/DemandsCalendarView";
import { isDateOverdue } from "@/lib/dateUtils";
import { InfoTooltip } from "@/components/InfoTooltip";
import { SelectedBoardChips, BoardMultiSelectButton } from "@/components/TeamDemandsFilters";
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

interface MyDemandsFiltersState {
  status: string | null;
  priority: string | null;
  boards: string[];
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
}

export default function MyDemands() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedTeamId, currentTeam } = useSelectedTeam();
  const { data: demands, isLoading } = useMyDemands(selectedTeamId);
  const { data: boards } = useBoards(selectedTeamId);
  
  const [searchQuery, setSearchQuery] = useState("");
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stateViewMode = (location.state as { viewMode?: ViewMode })?.viewMode;
    return stateViewMode || "table";
  });

  const [filters, setFilters] = useState<MyDemandsFiltersState>({
    status: null,
    priority: null,
    boards: [],
    dueDateFrom: null,
    dueDateTo: null,
  });
  
  const [hideDelivered, setHideDelivered] = useState(false);
  
  const [isTabletOrSmaller, setIsTabletOrSmaller] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      setIsTabletOrSmaller(window.innerWidth < TABLET_BREAKPOINT);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);
  
  const effectiveViewMode = isTabletOrSmaller && viewMode !== "calendar" ? "grid" : viewMode;

  const stats = useMemo(() => {
    if (!demands) return { total: 0, inProgress: 0, delivered: 0, overdue: 0 };

    const source = demands.filter((d: any) => {
      if (filters.boards.length > 0 && !filters.boards.includes(d.board_id)) return false;
      if (filters.priority && d.priority !== filters.priority) return false;
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
    const inProgress = source.filter((d: any) => d.demand_statuses?.name === "Fazendo").length;
    const delivered = source.filter((d: any) => d.demand_statuses?.name === "Entregue").length;
    const overdue = source.filter((d: any) => {
      if (!d.due_date) return false;
      if (d.demand_statuses?.name === "Entregue" || d.delivered_at) return false;
      return isDateOverdue(d.due_date);
    }).length;

    return { total, inProgress, delivered, overdue };
  }, [demands, filters]);

  const hasAnyFilter = filters.boards.length > 0 || filters.priority || filters.dueDateFrom || filters.dueDateTo;
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
    
    const filtered = demands.filter((d: any) => {
      if (hideDelivered && d.demand_statuses?.name === "Entregue") return false;
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          safeIncludesText(d.title, query) ||
          safeIncludesText(d.description, query) ||
          safeIncludesText(d.priority, query);
        if (!matchesSearch) return false;
      }
      
      if (filters.status && d.status_id !== filters.status) return false;
      if (filters.priority && d.priority !== filters.priority) return false;
      if (filters.boards.length > 0 && !filters.boards.includes(d.board_id)) return false;
      
      if (d.due_date) {
        const dueDate = new Date(d.due_date);
        if (filters.dueDateFrom && isBefore(dueDate, startOfDay(filters.dueDateFrom))) return false;
        if (filters.dueDateTo && isAfter(dueDate, endOfDay(filters.dueDateTo))) return false;
      } else if (filters.dueDateFrom || filters.dueDateTo) {
        return false;
      }
      
      return true;
    });
    
    return filtered.sort((a: any, b: any) => {
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
  }, [demands, searchQuery, filters, hideDelivered]);

  const renderDemandList = (demandList: typeof filteredDemands) => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <SEOHead title="Minhas Demandas" path="/my-demands" />
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground mt-4">{t("common.loading")}</p>
        </div>
      );
    }

    if (demandList.length === 0 && effectiveViewMode !== "calendar") {
      if (searchQuery) {
        return (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
            <SEOHead title="Minhas Demandas" path="/my-demands" />
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
          <SEOHead title="Minhas Demandas" path="/my-demands" />
          <User className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Nenhuma demanda encontrada
          </h3>
          <p className="text-muted-foreground mt-2">
            Você não possui demandas atribuídas ou criadas no momento
          </p>
        </div>
      );
    }

    if (effectiveViewMode === "calendar") {
      return (
        <DemandsCalendarView
          demands={demandList}
          onDemandClick={(demandId) => navigate(`/demands/${demandId}`, { state: { from: "my-demands", viewMode: "calendar" } })}
          onDayClick={() => {}}
          isRequester={false}
        />
      );
    }

    if (effectiveViewMode === "table") {
      return (
        <Card className="border-border/50 shadow-sm">
          <SEOHead title="Minhas Demandas" path="/my-demands" />
          <CardContent className="p-0">
            <DataTable
              columns={teamDemandColumns}
              data={demandList as unknown as TeamDemandTableRow[]}
              onRowClick={(row) => navigate(`/demands/${row.id}`, { state: { from: "my-demands", viewMode: "table" } })}
              defaultSorting={[{ id: "due_date", desc: false }]}
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <SEOHead title="Minhas Demandas" path="/my-demands" />
        {demandList.map((demand: any) => (
          <DemandCard
            key={demand.id}
            demand={demand}
            onClick={() => navigate(`/demands/${demand.id}`, { state: { from: "my-demands", viewMode: "grid" } })}
            showFullDetails
          />
        ))}
      </div>
    );
  };

  if (!selectedTeamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SEOHead title="Minhas Demandas" path="/my-demands" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Selecione uma equipe
            </h3>
            <p className="text-muted-foreground">
              Escolha uma equipe para ver suas demandas
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Minhas Demandas" path="/my-demands" />
      <PageBreadcrumb
        items={[
          { label: "Minhas Demandas", icon: User, isCurrent: true },
        ]}
      />
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Minhas Demandas
            </h1>
            <p className="text-sm text-muted-foreground">
              Demandas atribuídas ou criadas por você • {boards?.length || 0} quadros
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
                    <InfoTooltip text="Número total de demandas ativas atribuídas ou criadas por você." />
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
                    <InfoTooltip text="Suas demandas que estão atualmente sendo executadas (status 'Fazendo')." />
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
                    <InfoTooltip text="Suas demandas que foram concluídas e entregues." />
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
                    <InfoTooltip text="Suas demandas com prazo vencido que ainda não foram entregues." />
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-[220px] md:w-[280px]"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:ml-auto">
              <BoardMultiSelectButton
                teamId={selectedTeamId}
                selected={filters.boards}
                onChange={(boards) => setFilters({ ...filters, boards })}
              />

              {/* Priority filter */}
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
          value={filters.status}
          onChange={(status) => setFilters({ ...filters, status })}
        />
      </div>

      {/* Content */}
      {renderDemandList(filteredDemands)}
    </div>
  );
}
