import { useState, useMemo, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useFolderDemandIds, useDemandFolders, useUpdateFolder } from "@/hooks/useDemandFolders";
import { useAllTeamDemands } from "@/hooks/useAllTeamDemands";
import { useMembersByPosition } from "@/hooks/useMembersByPosition";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { DemandFilters, DemandFiltersState } from "@/components/DemandFilters";
import { DemandCard } from "@/components/DemandCard";
import { DataTable } from "@/components/ui/data-table";
import { demandColumns, DemandTableRow } from "@/components/demands/columns";
import { DemandsCalendarView } from "@/components/DemandsCalendarView";
import { StatusFilterTabs } from "@/components/StatusFilterTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FolderShareDialog } from "@/components/FolderShareDialog";
import { FolderDemandManager } from "@/components/FolderDemandManager";
import {
  Search, LayoutGrid, List, CalendarDays, ChevronDown, ChevronRight,
  FolderOpen, ArrowLeft, Eye, EyeOff, User, Pencil, Check, X, Users, Plus, Layers, LayoutList, Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { SEOHead } from "@/components/SEOHead";

type ViewMode = "table" | "grid" | "calendar";
const TABLET_BREAKPOINT = 1024;

export default function FolderDetail() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTeamId, selectedBoardId, setSelectedBoardId } = useSelectedBoard();

  const { data: folders } = useDemandFolders(currentTeamId, user?.id);
  const updateFolder = useUpdateFolder();
  const folder = folders?.find((f) => f.id === folderId);

  // Determine if user can edit this folder (owner or shared with edit permission)
  const canEdit = useMemo(() => {
    if (!folder || !user?.id) return false;
    if (folder.is_owner) return true;
    const share = folder.shared_with?.find((s) => s.user_id === user.id);
    return share?.permission === "edit";
  }, [folder, user?.id]);

  const { data: folderDemandIds } = useFolderDemandIds(folderId || null);
  const { data: allTeamDemands, isLoading } = useAllTeamDemands(currentTeamId);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [openBoards, setOpenBoards] = useState<Record<string, boolean>>({});
  const [hideDelivered, setHideDelivered] = useState(false);
  const [groupByBoard, setGroupByBoard] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    if (!canEdit || !folder) return;
    setEditName(folder.name);
    setIsEditingName(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (!trimmed || !folder) return;
    if (trimmed !== folder.name) {
      updateFolder.mutate({ id: folder.id, name: trimmed, color: folder.color });
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
  };
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [filters, setFilters] = useState<DemandFiltersState>({
    status: null, priority: null, assignee: null, service: null,
    dueDateFrom: null, dueDateTo: null, position: null,
  });

  const { data: membersByPosition } = useMembersByPosition(currentTeamId, filters.position);

  const [isTabletOrSmaller, setIsTabletOrSmaller] = useState(false);
  useEffect(() => {
    const check = () => setIsTabletOrSmaller(window.innerWidth < TABLET_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const effectiveViewMode = isTabletOrSmaller && viewMode !== "calendar" ? "grid" : viewMode;

  // Filter demands to only those in this folder
  const folderDemands = useMemo(() => {
    if (!allTeamDemands || !folderDemandIds) return [];
    return (allTeamDemands as any[]).filter((d) => folderDemandIds.includes(d.id));
  }, [allTeamDemands, folderDemandIds]);

  // Get unique board IDs from folder demands
  const folderBoardIds = useMemo(() => {
    return [...new Set(folderDemands.map((d: any) => d.board_id as string))];
  }, [folderDemands]);

  // Apply filters
  const filteredDemands = useMemo(() => {
    return folderDemands.filter((d: any) => {
      if (showOnlyMine && user?.id) {
        const isAssigned = d.demand_assignees?.some((a: any) => a.user_id === user.id) || d.assigned_to === user.id;
        if (!isAssigned) return false;
      }
      if (hideDelivered && d.demand_statuses?.name === "Entregue") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !d.title?.toLowerCase().includes(q) &&
          !d.description?.toLowerCase().includes(q) &&
          !d.priority?.toLowerCase().includes(q) &&
          !d.demand_statuses?.name?.toLowerCase().includes(q)
        ) return false;
      }
      if (filters.status && d.status_id !== filters.status) return false;
      if (filters.priority && d.priority !== filters.priority) return false;
      if (filters.assignee) {
        const isAssigned = d.demand_assignees?.some((a: any) => a.user_id === filters.assignee) || d.assigned_to === filters.assignee;
        if (!isAssigned) return false;
      }
      if (filters.service && d.service_id !== filters.service) return false;
      if (filters.position && membersByPosition) {
        const has = d.demand_assignees?.some((a: any) => membersByPosition.includes(a.user_id)) ||
          (d.assigned_to && membersByPosition.includes(d.assigned_to));
        if (!has) return false;
      }
      if (filters.dueDateFrom && d.due_date) {
        if (isBefore(new Date(d.due_date), startOfDay(new Date(filters.dueDateFrom)))) return false;
      }
      if (filters.dueDateTo && d.due_date) {
        if (isAfter(new Date(d.due_date), endOfDay(new Date(filters.dueDateTo)))) return false;
      }
      return true;
    });
  }, [folderDemands, searchQuery, filters, hideDelivered, showOnlyMine, user?.id, membersByPosition]);

  // Group by board
  const groupedByBoard = useMemo(() => {
    const map = new Map<string, { boardId: string; boardName: string; demands: any[] }>();
    for (const d of filteredDemands) {
      const boardId = d.board_id || "unknown";
      const boardName = d.boards?.name || "Sem quadro";
      if (!map.has(boardId)) map.set(boardId, { boardId, boardName, demands: [] });
      map.get(boardId)!.demands.push(d);
    }
    return Array.from(map.values()).sort((a, b) => a.boardName.localeCompare(b.boardName));
  }, [filteredDemands]);

  // Default open all boards
  useEffect(() => {
    if (groupedByBoard.length > 0 && Object.keys(openBoards).length === 0) {
      const initial: Record<string, boolean> = {};
      groupedByBoard.forEach((g) => (initial[g.boardId] = true));
      setOpenBoards(initial);
    }
  }, [groupedByBoard]);

  const toggleBoard = (boardId: string) => {
    setOpenBoards((prev) => ({ ...prev, [boardId]: !prev[boardId] }));
  };

  const isBoardOpen = (boardId: string) => openBoards[boardId] ?? true;

  const handleDemandClick = (demandId: string, boardId?: string) => {
    if (boardId && boardId !== selectedBoardId) setSelectedBoardId(boardId);
    navigate(`/demands/${demandId}`, { state: { from: "folder", folderId } });
  };

  const deliveredCount = folderDemands.filter((d: any) => d.demand_statuses?.name === "Entregue").length;
  const myCount = folderDemands.filter((d: any) =>
    d.demand_assignees?.some((a: any) => a.user_id === user?.id) || d.assigned_to === user?.id
  ).length;

  const mapToTableRow = (d: any): DemandTableRow => ({
    id: d.id,
    title: d.title,
    description: d.description,
    priority: d.priority,
    due_date: d.due_date,
    delivered_at: d.delivered_at,
    created_at: d.created_at,
    updated_at: d.updated_at,
    time_in_progress_seconds: d.time_in_progress_seconds,
    last_started_at: d.last_started_at,
    board_sequence_number: d.board_sequence_number,
    service_id: d.service_id,
    demand_statuses: d.demand_statuses,
    services: d.services,
    profiles: d.profiles,
    demand_assignees: d.demand_assignees,
    assigned_profile: d.assigned_profile,
    boards: d.boards,
  });

  if (!folder) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Projeto não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/demands")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para demandas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <SEOHead title={`Projeto - ${folder.name}`} />
      <PageBreadcrumb
        items={[
          { label: "Projetos", href: "/projects", icon: Briefcase },
          { label: folder.name, icon: FolderOpen, isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <FolderOpen className="h-6 w-6 shrink-0" style={{ color: folder.color }} />
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-1.5 mb-1">
              <Input
                ref={editInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="h-8 text-xl font-bold px-2 max-w-xs focus-visible:ring-offset-0"
              />
              <button onClick={handleSaveName} className="p-1 rounded hover:bg-emerald-500/10 text-emerald-600">
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="group/title flex items-center gap-1.5">
              <h1 className="text-xl font-bold text-foreground truncate">{folder.name}</h1>
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {filteredDemands.length} {filteredDemands.length === 1 ? "demanda" : "demandas"}
            {groupedByBoard.length > 0 && ` em ${groupedByBoard.length} ${groupedByBoard.length === 1 ? "quadro" : "quadros"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setManagerOpen(true)}
                  className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-lg border border-border/60 hover:bg-primary/10 hover:border-primary/30 transition-colors"
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span className="hidden md:inline text-xs font-medium text-primary">Adicionar demanda</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">Adicionar demanda</TooltipContent>
            </Tooltip>
          )}
          {folder.is_owner && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-lg border border-border/60 hover:bg-muted/60 transition-colors"
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden md:inline text-xs font-medium text-muted-foreground">Compartilhar projeto</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="md:hidden">Compartilhar projeto</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Search + View Toggle + Quick Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar demandas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 rounded-full text-xs border-border/60"
            />
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {/* Grouped by board: list or grid */}
            <div className="flex items-center border border-border/60 rounded-full p-0.5 bg-background">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-all duration-200 ${
                      groupByBoard && effectiveViewMode === "table"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:text-primary"
                    }`}
                    onClick={() => { setGroupByBoard(true); setViewMode("table"); }}
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Agrupar por quadro (lista)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-all duration-200 ${
                      groupByBoard && effectiveViewMode === "grid"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:text-primary"
                    }`}
                    onClick={() => { setGroupByBoard(true); setViewMode("grid"); }}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Agrupar por quadro (blocos)</TooltipContent>
              </Tooltip>
            </div>

            <span className="text-muted-foreground/40 text-xs select-none">|</span>

            {/* Flat views */}
            <div className="flex items-center border border-border/60 rounded-full p-0.5 bg-background">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-all duration-200 ${
                      !groupByBoard && effectiveViewMode === "table"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:text-primary"
                    }`}
                    onClick={() => { setGroupByBoard(false); setViewMode("table"); }}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Lista geral</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-all duration-200 ${
                      !groupByBoard && effectiveViewMode === "grid"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:text-primary"
                    }`}
                    onClick={() => { setGroupByBoard(false); setViewMode("grid"); }}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Blocos geral</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-all duration-200 ${
                      !groupByBoard && effectiveViewMode === "calendar"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:text-primary"
                    }`}
                    onClick={() => { setGroupByBoard(false); setViewMode("calendar"); }}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Calendário</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Filters + Quick toggles */}
          <DemandFilters
            boardId={null}
            filters={filters}
            onChange={setFilters}
            availableBoardIds={folderBoardIds}
          />

          <button
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8 transition-all duration-200 whitespace-nowrap ${
              hideDelivered
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-background border border-border/60 hover:border-emerald-500/60 hover:text-emerald-600"
            }`}
            onClick={() => setHideDelivered(!hideDelivered)}
          >
            {hideDelivered ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>Entregues ({deliveredCount})</span>
          </button>

          <button
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8 transition-all duration-200 whitespace-nowrap ${
              showOnlyMine
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background border border-border/60 hover:border-primary/40 hover:text-primary"
            }`}
            onClick={() => setShowOnlyMine(!showOnlyMine)}
          >
            <User className="h-3.5 w-3.5" />
            <span>Minhas ({myCount})</span>
          </button>
        </div>
      </div>

      {/* Calendar View (always flat) */}
      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : !groupByBoard && effectiveViewMode === "calendar" ? (
        <DemandsCalendarView
          demands={filteredDemands}
          onDemandClick={(id) => handleDemandClick(id)}
          onDayClick={() => {}}
          initialDate={calendarMonth}
          onDateChange={setCalendarMonth}
        />
      ) : !groupByBoard ? (
        /* Flat list/grid view */
        <div>
          {effectiveViewMode === "table" ? (
            <DataTable
              columns={demandColumns}
              data={filteredDemands.map(mapToTableRow)}
              onRowClick={(row) => handleDemandClick(row.id)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredDemands.map((d: any) => (
                <DemandCard
                  key={d.id}
                  demand={d}
                  onClick={() => handleDemandClick(d.id, d.board_id)}
                />
              ))}
            </div>
          )}
          {filteredDemands.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {folderDemandIds?.length === 0
                  ? "Nenhuma demanda neste projeto ainda"
                  : "Nenhuma demanda encontrada com os filtros atuais"}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Board-grouped view (default) */
        <div className="space-y-3">
          {groupedByBoard.map((group) => (
            <Collapsible
              key={group.boardId}
              open={isBoardOpen(group.boardId)}
              onOpenChange={() => toggleBoard(group.boardId)}
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-[#F28705] hover:bg-[#D95204] transition-colors text-left border border-[#F28705]/60">
                {isBoardOpen(group.boardId) ? (
                  <ChevronDown className="h-4 w-4 text-white shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-white shrink-0" />
                )}
                <span className="text-sm font-semibold text-white truncate flex-1">
                  {group.boardName}
                </span>
                <Badge className="text-[11px] h-5 px-2 bg-white text-[#F28705] hover:bg-white/90 border-0">
                  {group.demands.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 ml-1">
                  {effectiveViewMode === "table" ? (
                    <DataTable
                      columns={demandColumns}
                      data={group.demands.map(mapToTableRow)}
                      onRowClick={(row) => handleDemandClick(row.id, group.boardId)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {group.demands.map((d: any) => (
                        <DemandCard
                          key={d.id}
                          demand={d}
                          onClick={() => handleDemandClick(d.id, group.boardId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {groupedByBoard.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {folderDemandIds?.length === 0
                  ? "Nenhuma demanda neste projeto ainda"
                  : "Nenhuma demanda encontrada com os filtros atuais"}
              </p>
            </div>
          )}
        </div>
      )}

      {folder.is_owner && (
        <FolderShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          folderId={folder.id}
          folderName={folder.name}
          teamId={currentTeamId}
          sharedWith={folder.shared_with || []}
        />
      )}

      <FolderDemandManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        folderId={folder.id}
        folderName={folder.name}
        teamId={currentTeamId}
      />
    </div>
  );
}
