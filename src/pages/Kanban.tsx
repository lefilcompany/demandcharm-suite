import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { KanbanBoard } from "@/components/KanbanBoard";
import { KanbanSkeleton } from "@/components/skeletons/KanbanSkeleton";
import { KanbanNotifications } from "@/components/KanbanNotifications";
import { KanbanFilters, KanbanFiltersState } from "@/components/KanbanFilters";
import { KanbanStagesManager } from "@/components/KanbanStagesManager";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useDemands } from "@/hooks/useDemands";
import { useServices } from "@/hooks/useServices";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useBoard } from "@/hooks/useBoards";
import { useAuth } from "@/lib/auth";
import { useMembersByPosition } from "@/hooks/useMembersByPosition";
import { useIsTeamAdminOrModerator } from "@/hooks/useTeamRole";
import { useKanbanColumns } from "@/hooks/useBoardStatuses";
import { useKanbanPreferences } from "@/hooks/useKanbanPreferences";
import { Plus, LayoutGrid, Columns3, Loader2, Kanban as KanbanIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRealtimeDemands, useKanbanRealtimeNotifications } from "@/hooks/useRealtimeDemands";
import { isToday, isThisWeek, isPast } from "date-fns";
import { ScheduledDemandsModal } from "@/components/ScheduledDemandsModal";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { useTeamMembershipRole } from "@/hooks/useTeamRole";
import { SEOHead } from "@/components/SEOHead";

export default function Kanban() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openCreateDemand } = useCreateDemandModal();
  const { user } = useAuth();
  const { selectedBoardId, currentTeamId } = useSelectedBoard();
  const { data: demands, isLoading } = useDemands(selectedBoardId || undefined);
  const { data: role } = useBoardRole(selectedBoardId);
  const { data: teamMembershipRole } = useTeamMembershipRole(currentTeamId);
  const { data: currentBoard } = useBoard(selectedBoardId);
  const { canManage } = useIsTeamAdminOrModerator(currentTeamId);
  const { columns: kanbanColumns } = useKanbanColumns(selectedBoardId, role);
  const { preferences, toggleDefaultColumnsOpen, isSaving, isLoading: isLoadingPrefs } = useKanbanPreferences();
  
  // Persist filters per user across board switches and tab reloads.
  // Cleared explicitly on signOut and on short-session expiry (see src/lib/auth.tsx).
  const filtersStorageKey = user?.id ? `kanban_filters:${user.id}` : null;
  const defaultFilters: KanbanFiltersState = {
    myTasks: false,
    priority: null,
    dueDate: null,
    position: null,
    assignee: null,
    service: null,
  };

  const readStoredFilters = (key: string | null): KanbanFiltersState => {
    if (!key || typeof window === "undefined") return defaultFilters;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return defaultFilters;
      const parsed = JSON.parse(stored) as Partial<KanbanFiltersState>;
      return { ...defaultFilters, ...parsed };
    } catch {
      return defaultFilters;
    }
  };

  const [filters, setFilters] = useState<KanbanFiltersState>(() => readStoredFilters(filtersStorageKey));

  // Re-hydrate when the user becomes available after the initial mount.
  useEffect(() => {
    if (!filtersStorageKey) return;
    setFilters(readStoredFilters(filtersStorageKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersStorageKey]);

  // Persist filters whenever they change.
  useEffect(() => {
    if (!filtersStorageKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(filtersStorageKey, JSON.stringify(filters));
    } catch {
      // ignore quota errors
    }
  }, [filters, filtersStorageKey]);
  
  // Fetch members with selected position for filtering
  const { data: membersByPosition } = useMembersByPosition(currentTeamId, filters.position);
  const { data: allServices } = useServices(currentTeamId, selectedBoardId);
  
  // Build a map of parent service ID -> array of child service IDs
  const serviceChildMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!allServices) return map;
    allServices.forEach(s => {
      if (s.parent_id) {
        if (!map[s.parent_id]) map[s.parent_id] = [];
        map[s.parent_id].push(s.id);
      }
    });
    return map;
  }, [allServices]);
  
  // Enable realtime updates for demands
  useRealtimeDemands(selectedBoardId || undefined);
  
  // Enable realtime notifications for card moves
  const { 
    notifications, 
    clearNotification, 
    clearAllNotifications 
  } = useKanbanRealtimeNotifications(selectedBoardId || undefined);

  const isReadOnly = role === "requester" || (!role && teamMembershipRole === "requester");

  // Filter demands based on all filters
  const filteredDemands = useMemo(() => {
    if (!demands) return [];
    
    return demands.filter((d) => {
      // My tasks filter
      if (filters.myTasks && user?.id) {
        const isAssigned = d.demand_assignees?.some(
          (a) => a.user_id === user.id
        ) || d.assigned_to === user.id;
        if (!isAssigned) return false;
      }
      
      // Priority filter
      if (filters.priority && d.priority !== filters.priority) {
        return false;
      }
      
      // Due date filter
      if (filters.dueDate && d.due_date) {
        const dueDate = new Date(d.due_date);
        if (filters.dueDate === "overdue" && !isPast(dueDate)) return false;
        if (filters.dueDate === "today" && !isToday(dueDate)) return false;
        if (filters.dueDate === "week" && !isThisWeek(dueDate)) return false;
      } else if (filters.dueDate && !d.due_date) {
        return false;
      }
      
      // Position filter - filter by members with selected position
      if (filters.position && membersByPosition) {
        const hasAssigneeWithPosition = d.demand_assignees?.some(
          (a) => membersByPosition.includes(a.user_id)
        ) || (d.assigned_to && membersByPosition.includes(d.assigned_to));
        if (!hasAssigneeWithPosition) return false;
      }

      // Assignee filter
      if (filters.assignee) {
        const isAssigned = d.demand_assignees?.some(
          (a) => a.user_id === filters.assignee
        ) || d.assigned_to === filters.assignee;
        if (!isAssigned) return false;
      }

      // Service filter - include child services when a parent (macro) service is selected
      if (filters.service) {
        if (d.service_id === filters.service) {
          // Direct match
        } else if (serviceChildMap[filters.service]?.includes(d.service_id || "")) {
          // Demand has a child service of the selected parent
        } else {
          return false;
        }
      }
      
      return true;
    });
  }, [demands, filters, user?.id, membersByPosition, serviceChildMap]);

  // Count user's demands
  const myDemandsCount = useMemo(() => {
    if (!demands || !user?.id) return 0;
    return demands.filter((d) => {
      const isAssigned = d.demand_assignees?.some(
        (a) => a.user_id === user.id
      ) || d.assigned_to === user.id;
      return isAssigned;
    }).length;
  }, [demands, user?.id]);

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
      <SEOHead title="Kanban" path="/kanban" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between shrink-0 pb-4 md:pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {t("kanban.title")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isReadOnly ? t("kanban.dragHint") : t("kanban.dragHint")}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {/* Kanban Column Preference Switch */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md border bg-background/50 shrink-0">
                  <Columns3 className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    id="columns-open-preference"
                    checked={preferences.defaultColumnsOpen}
                    onCheckedChange={toggleDefaultColumnsOpen}
                    disabled={isSaving || isLoadingPrefs}
                  />
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">
                  {preferences.defaultColumnsOpen 
                    ? t("kanban.columnsOpenByDefault") 
                    : t("kanban.columnsClosedByDefault")}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Kanban Stage Manager - only for admins/moderators */}
          {canManage && selectedBoardId && (
            <KanbanStagesManager boardId={selectedBoardId} />
          )}

          {/* Kanban Filters */}
          <KanbanFilters 
            teamId={currentTeamId} 
            boardId={selectedBoardId}
            filters={filters} 
            onChange={setFilters} 
          />

          {/* Scheduled demands */}
          <ScheduledDemandsModal boardId={selectedBoardId} teamId={currentTeamId} buttonStyle="standard" />

        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {!selectedBoardId ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {t("teams.title")}
            </h3>
            <p className="text-muted-foreground mt-2">
              {t("common.noResults")}
            </p>
          </div>
        ) : isLoading && (!demands || demands.length === 0) ? (
          <KanbanSkeleton columns={kanbanColumns?.length || 5} />
        ) : (
          <KanbanBoard 
            demands={filteredDemands} 
            columns={kanbanColumns}
            onDemandClick={id => navigate(`/demands/${id}`, { state: { from: "kanban" } })} 
            readOnly={isReadOnly}
            userRole={role || undefined}
            boardName={currentBoard?.name}
            boardId={selectedBoardId || undefined}
            initialColumnsOpen={preferences.defaultColumnsOpen}
          />
        )}
      </div>
      
      {/* Real-time notifications for card moves */}
      <KanbanNotifications
        notifications={notifications}
        onClear={clearNotification}
        onClearAll={clearAllNotifications}
        onDemandClick={(id) => navigate(`/demands/${id}`, { state: { from: "kanban" } })}
      />
    </div>
  );
}
