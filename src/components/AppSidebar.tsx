import { LayoutDashboard, Users, User, Briefcase, Kanban, ChevronUp, Settings, FileText, Send, LayoutGrid, UserPlus, UsersRound, Clock, Sparkles, ShoppingCart, Layers, StickyNote, LayoutList, CornerUpLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
const logoSoma = "/logo-soma-sidebar.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePendingRequestsCount as usePendingDemandRequestsCount, useReturnedRequestsCount } from "@/hooks/useDemandRequests";
import { usePendingRequestsCount as usePendingJoinRequestsCount } from "@/hooks/useTeamJoinRequests";
import { useTeamMembershipRole, useTeamRole } from "@/hooks/useTeamRole";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamSubscription } from "@/hooks/useSubscription";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { SidebarSyncIndicator } from "@/components/SidebarSyncIndicator";
import { SidebarActiveTimers } from "@/components/SidebarActiveTimers";
import { SidebarSubscriptionCard } from "@/components/SidebarSubscriptionCard";

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const { t } = useTranslation();
  const {
    state,
    setOpenMobile,
    isMobile
  } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const {
    selectedTeamId,
    currentTeam
  } = useSelectedTeam();
  const { selectedBoardId } = useSelectedBoardSafe();
  const {
    data: role
  } = useTeamRole(selectedTeamId);
  const { data: teamMembershipRole } = useTeamMembershipRole(selectedTeamId);
  const { data: boardRole } = useBoardRole(selectedBoardId);
  const { data: pendingDemandRequests } = usePendingDemandRequestsCount();
  const { data: pendingJoinRequests } = usePendingJoinRequestsCount(selectedTeamId);
  const { data: returnedRequestsCount } = useReturnedRequestsCount();
  const { data: subscription } = useTeamSubscription(currentTeam?.id);
  
  const isTeamAdminOrModerator = role === "owner";
  const isBoardAdminOrModerator = boardRole === "admin" || boardRole === "moderator";
  const isBoardAdminModeratorOrExecutor = boardRole === "admin" || boardRole === "moderator" || boardRole === "executor";
  const isRequester = boardRole === "requester" || (!boardRole && teamMembershipRole === "requester");

  // Detect "team view" routes - the team dropdown items
  const isTeamView =
    location.pathname === "/team-demands" ||
    location.pathname === "/boards" ||
    location.pathname.startsWith("/boards/") ||
    location.pathname.startsWith("/teams/") ||
    location.pathname === "/teams" ||
    location.pathname === "/projects" ||
    location.pathname.startsWith("/projects/") ||
    location.pathname.startsWith("/folders/");

  const lastBoardRoute = "/";

  const teamViewMenuItems: any[] = isTeamView
    ? [
        
        { title: "Visão Geral", url: "/team-demands", icon: Layers },
        { title: "Meus Quadros", url: "/boards", icon: LayoutGrid },
        { title: "Projetos", url: "/projects", icon: Briefcase },
        ...(selectedTeamId
          ? [{ title: "Participantes", url: `/teams/${selectedTeamId}`, icon: UsersRound, end: true }]
          : []),
        ...(isTeamAdminOrModerator && selectedTeamId
          ? [
              { title: "Serviços", url: `/teams/${selectedTeamId}/services`, icon: Settings },
              { title: "Solicitações", url: `/teams/${selectedTeamId}/requests`, icon: UserPlus, showJoinRequestBadge: true },
            ]
          : []),
      ]
    : [];

  const baseMenuItems = [{
    title: t("dashboard.title"),
    url: "/",
    icon: LayoutDashboard
  }, {
    title: t("kanban.title"),
    url: "/kanban",
    icon: Kanban
  }, {
    title: t("demands.title"),
    url: "/demands",
    icon: LayoutList
  }];

  // Add demand requests link for admins/moderators/executors OR requesters (they can view)
  const adminMenuItems = (isBoardAdminModeratorOrExecutor || isRequester) ? [
    {
      title: "Solicitações de Demanda",
      url: "/demand-requests",
      icon: Send,
      showDemandRequestBadge: true
    },
    ...((isBoardAdminOrModerator) ? [{
      title: "Gerenciamento de Tempo",
      url: "/time-management",
      icon: Clock
    }] : [])
  ] : [];

  // Requester-specific items (store + my requests) - always shown for requesters
  const requesterMenuItems = isRequester ? [
    {
      title: "Loja de Serviços",
      url: "/store",
      icon: ShoppingCart
    }
  ] : [];

  const aiMenuItems = [
    {
      title: "Resumo IA",
      url: "/board-summary",
      icon: Sparkles
    }
  ];

  // Soma Notes - temporarily hidden (keep code for future re-activation)
  const notesMenuItems: typeof baseMenuItems = [];

  const boardMenuItems = [...baseMenuItems, ...adminMenuItems, ...requesterMenuItems, ...aiMenuItems, ...notesMenuItems];

  const menuItems = isTeamView ? teamViewMenuItems : boardMenuItems;

  // Keep team section expanded if on team/board routes
  const isOnTeamRoute = location.pathname.startsWith("/boards") || location.pathname.startsWith("/team-config") || location.pathname.includes("/services") || location.pathname.includes("/requests") || location.pathname === "/team-demands" || location.pathname === "/my-demands";
  const [teamOpen, setTeamOpen] = useState(isOnTeamRoute);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };


  const showText = isMobile || !isCollapsed;

  return (
    <Sidebar collapsible="icon" data-tour="sidebar">
      <SidebarContent className="overflow-y-auto flex flex-col">
        <NavLink to="/" onClick={closeMobileSidebar} className={`items-center justify-center flex flex-col hover:opacity-80 transition-opacity cursor-pointer my-4 md:my-6 ${isCollapsed && !isMobile ? 'mx-auto w-full' : 'px-0 py-0 mx-0'}`}>
          {/* Both logos are always mounted to avoid reload flicker when toggling sidebar */}
          <img
            alt="SoMA"
            src="/lovable-uploads/8967ad53-156a-4e31-a5bd-b472b7cde839.png"
            width={20}
            height={20}
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            className={`h-5 w-5 object-scale-down mx-auto ${isCollapsed && !isMobile ? "block" : "hidden"}`}
          />
          <img
            src={logoSoma}
            alt="SoMA"
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            className={`h-8 md:h-10 w-auto ${isCollapsed && !isMobile ? "hidden" : "block"}`}
          />
        </NavLink>

        {isTeamView && showText && (
          <div className="mx-2 px-2 pt-2 pb-1">
            <NavLink
              to={lastBoardRoute}
              onClick={closeMobileSidebar}
              className="group inline-flex w-fit max-w-full items-center gap-1.5 min-w-0 text-primary font-semibold uppercase tracking-wide text-[11px] underline underline-offset-4 decoration-primary/50 hover:decoration-primary hover:bg-primary/10 rounded-md px-1.5 py-1 -ml-1.5 transition-colors"
              aria-label="Voltar ao quadro"
              title="Voltar ao quadro"
            >
              <CornerUpLeft className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span className="truncate">{currentTeam?.name || "Equipe"}</span>
            </NavLink>
          </div>
        )}

        {isTeamView && !showText && (
          <div className="flex justify-center pt-1 pb-0.5">
            <NavLink
              to={lastBoardRoute}
              onClick={closeMobileSidebar}
              className="group inline-flex items-center justify-center text-primary hover:bg-primary/10 rounded-md p-1.5 underline underline-offset-4 decoration-primary/50 hover:decoration-primary transition-colors"
              aria-label="Voltar ao quadro"
              title="Voltar ao quadro"
            >
              <CornerUpLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
            </NavLink>
          </div>
        )}

        <SidebarGroup
          className={
            isTeamView && showText
              ? "mx-2 w-auto rounded-lg border border-primary/50 bg-gradient-to-b from-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.35),0_2px_6px_-1px_rgba(0,0,0,0.6),inset_0_1px_0_hsl(var(--primary)/0.25)]"
              : undefined
          }
        >
          {!isTeamView && (
            <SidebarGroupLabel>{t("common.actions")}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {menuItems.map(item => {
              const tourId = !isTeamView && item.url === "/" ? "dashboard-link" 
                  : item.url === "/kanban" ? "kanban-link"
                  : item.url === "/demands" ? "demands-link"
                  : undefined;
                const isBack = (item as any).isBackAction;
                const hasBadge = (item as any).showDemandRequestBadge || (item as any).showJoinRequestBadge || (item as any).showReturnedBadge;
                return (
                <SidebarMenuItem key={item.title} className="relative" data-tour={tourId}>
                    <SidebarMenuButton asChild tooltip={item.title} size="default" className={`h-auto min-h-8 py-1.5 overflow-visible ${showText ? 'items-start' : 'items-center justify-center'}`}>
                      <NavLink to={item.url} end={(item as any).end ?? !isTeamView} onClick={closeMobileSidebar} className={`flex min-w-0 hover:bg-sidebar-accent transition-colors ${showText ? 'w-full items-start gap-2' : 'items-center justify-center'} ${isBack ? 'text-muted-foreground' : ''}`} activeClassName={isBack ? '' : 'bg-sidebar-accent text-sidebar-primary font-medium'}>
                        <item.icon className={`h-4 w-4 shrink-0 ${showText ? 'mt-0.5' : ''}`} />
                        {showText && <span className={`text-sm flex-1 min-w-0 whitespace-normal break-words leading-snug ${hasBadge ? 'pr-7' : ''}`}>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    {showText && (item as any).showDemandRequestBadge && typeof pendingDemandRequests === "number" && pendingDemandRequests > 0 && (
                      <Badge className="absolute right-2 top-1/2 -translate-y-1/2 h-4 min-w-4 flex items-center justify-center text-[10px] p-0 px-1 rounded-full bg-[#F28705] text-white border-0 pointer-events-none">
                        {pendingDemandRequests}
                      </Badge>
                    )}
                    {showText && (item as any).showJoinRequestBadge && typeof pendingJoinRequests === "number" && pendingJoinRequests > 0 && (
                      <Badge variant="destructive" className="absolute right-2 top-1/2 -translate-y-1/2 h-5 min-w-5 flex items-center justify-center text-xs pointer-events-none">
                        {pendingJoinRequests}
                      </Badge>
                    )}
                    {showText && (item as any).showReturnedBadge && typeof returnedRequestsCount === "number" && returnedRequestsCount > 0 && (
                      <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 h-5 min-w-5 flex items-center justify-center text-xs border-amber-500 text-amber-500 bg-amber-500/10 pointer-events-none">
                        {returnedRequestsCount}
                      </Badge>
                    )}
                    {isCollapsed && !isMobile && (item as any).showDemandRequestBadge && typeof pendingDemandRequests === "number" && pendingDemandRequests > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center text-[10px] p-0 px-1 rounded-full bg-[#F28705] text-white border-0">
                        {pendingDemandRequests}
                      </Badge>
                    )}
                    {isCollapsed && !isMobile && (item as any).showJoinRequestBadge && typeof pendingJoinRequests === "number" && pendingJoinRequests > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center text-[10px] p-0 px-1">
                        {pendingJoinRequests}
                      </Badge>
                    )}
                    {isCollapsed && !isMobile && (item as any).showReturnedBadge && typeof returnedRequestsCount === "number" && returnedRequestsCount > 0 && (
                      <Badge variant="outline" className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center text-[10px] p-0 px-1 border-amber-500 text-amber-500 bg-amber-500/10">
                        {returnedRequestsCount}
                      </Badge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Timers Section - Above Team section */}
        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <SidebarActiveTimers />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Team section */}
        <SidebarGroup className="mt-auto pb-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
{/* Equipe - Dropdown style like reference image */}
              <SidebarMenuItem data-tour="teams-link">
                {isTeamView ? (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`
                            flex items-center transition-all duration-200
                            ${isCollapsed && !isMobile
                              ? 'w-10 h-10 justify-center rounded-full border border-sidebar-border/50'
                              : 'w-full gap-3 p-2.5 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/30'
                            }
                          `}
                        >
                          <div className={`
                            flex items-center justify-center bg-gradient-to-br from-primary/25 to-primary/10
                            ${isCollapsed && !isMobile ? 'h-7 w-7 rounded-full' : 'h-8 w-8 rounded-full ring-1 ring-primary/20'}
                          `}>
                            <Users className={`text-primary ${isCollapsed && !isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                          </div>
                          {(!isCollapsed || isMobile) && (
                            <div className="flex-1 text-left min-w-0">
                              <span className="text-sm font-medium text-sidebar-foreground block truncate">{currentTeam?.name || "Equipe"}</span>
                              {subscription?.plan?.name && (
                                <span className="text-[11px] text-muted-foreground truncate block">{subscription.plan.name}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      {isCollapsed && !isMobile && (
                        <TooltipContent side="right">
                          <p className="font-medium">{currentTeam?.name || "Equipe"}</p>
                          {subscription?.plan?.name && (
                            <p className="text-xs text-muted-foreground">{subscription.plan.name}</p>
                          )}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                <DropdownMenu open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button 
                            className={`
                              flex items-center transition-all duration-200
                              focus:outline-none focus:ring-2 focus:ring-primary/20
                              ${isCollapsed && !isMobile 
                                ? `w-10 h-10 justify-center rounded-full border border-sidebar-border/50 hover:border-primary/40 hover:bg-primary/10 ${popoverOpen ? 'bg-primary/15 border-primary/40 ring-2 ring-primary/20' : ''}`
                                : `w-full gap-3 p-2.5 rounded-xl border border-sidebar-border/50 hover:border-primary/30 hover:bg-sidebar-accent/50 ${popoverOpen ? 'bg-sidebar-accent/50 border-primary/30' : ''}`
                              }
                            `}
                          >
                            <div className={`
                              flex items-center justify-center bg-gradient-to-br from-primary/25 to-primary/10 
                              ${isCollapsed && !isMobile 
                                ? 'h-7 w-7 rounded-full' 
                                : 'h-8 w-8 rounded-full ring-1 ring-primary/20'
                              }
                            `}>
                              <Users className={`text-primary ${isCollapsed && !isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                            </div>
                            {(!isCollapsed || isMobile) && (
                              <>
                                <div className="flex-1 text-left min-w-0">
                                  <span className="text-sm font-medium text-sidebar-foreground block truncate">{currentTeam?.name || "Equipe"}</span>
                                  {subscription?.plan?.name && (
                                    <span className="text-[11px] text-muted-foreground truncate block">{subscription.plan.name}</span>
                                  )}
                                </div>
                                <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${popoverOpen ? '' : 'rotate-180'}`} />
                              </>
                            )}
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      {isCollapsed && !isMobile && !popoverOpen && (
                        <TooltipContent side="right">
                          <p className="font-medium">{currentTeam?.name || "Equipe"}</p>
                          {subscription?.plan?.name && (
                            <p className="text-xs text-muted-foreground">{subscription.plan.name}</p>
                          )}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenuContent 
                    side="top" 
                    align={isCollapsed && !isMobile ? "center" : "start"}
                    sideOffset={8} 
                    className="min-w-56 rounded-xl shadow-xl border border-border bg-white dark:bg-zinc-900 backdrop-blur-md animate-slide-up-fade p-2"
                  >
                    {/* Header with icon and info */}
                    <div className="flex items-center gap-3 p-3 mb-1 rounded-lg bg-gray-100 dark:bg-zinc-800">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center ring-2 ring-primary/20 shadow-sm">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentTeam?.name || "Equipe"}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Gerenciamento</span>
                      </div>
                    </div>
                    
                    <DropdownMenuSeparator className="my-2" />
                    
                    {/* Menu items with icons */}
                    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                      <NavLink 
                        to="/team-demands" 
                        onClick={() => { setPopoverOpen(false); closeMobileSidebar(); }} 
                        className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 w-full" 
                        activeClassName="bg-gray-100 dark:bg-zinc-800 text-primary font-medium"
                      >
                        <Layers className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">Visão Geral</span>
                      </NavLink>
                    </DropdownMenuItem>
                    
                    
                    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                      <NavLink 
                        to="/boards" 
                        onClick={() => { setPopoverOpen(false); closeMobileSidebar(); }} 
                        className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 w-full" 
                        activeClassName="bg-gray-100 dark:bg-zinc-800 text-primary font-medium"
                      >
                        <LayoutGrid className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">Meus Quadros</span>
                      </NavLink>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                      <NavLink
                        to="/projects"
                        onClick={() => { setPopoverOpen(false); closeMobileSidebar(); }}
                        className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 w-full"
                        activeClassName="bg-gray-100 dark:bg-zinc-800 text-primary font-medium"
                      >
                        <Briefcase className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">Projetos</span>
                      </NavLink>
                    </DropdownMenuItem>
                    
                    {selectedTeamId && (
                      <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                        <NavLink 
                          to={`/teams/${selectedTeamId}`} 
                          end 
                          onClick={() => { setPopoverOpen(false); closeMobileSidebar(); }} 
                          className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 w-full" 
                          activeClassName="bg-gray-100 dark:bg-zinc-800 text-primary font-medium"
                        >
                          <UsersRound className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-200">Participantes</span>
                        </NavLink>
                      </DropdownMenuItem>
                    )}
                    
                    {isTeamAdminOrModerator && selectedTeamId && (
                      <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                        <NavLink 
                          to={`/teams/${selectedTeamId}/services`} 
                          onClick={() => { setPopoverOpen(false); closeMobileSidebar(); }} 
                          className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 w-full" 
                          activeClassName="bg-gray-100 dark:bg-zinc-800 text-primary font-medium"
                        >
                          <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-200">Serviços</span>
                        </NavLink>
                      </DropdownMenuItem>
                    )}
                    
                    {isTeamAdminOrModerator && selectedTeamId && (
                      <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                        <NavLink 
                          to={`/teams/${selectedTeamId}/requests`} 
                          onClick={() => { setPopoverOpen(false); closeMobileSidebar(); }} 
                          className="flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 w-full" 
                          activeClassName="bg-gray-100 dark:bg-zinc-800 text-primary font-medium"
                        >
                          <UserPlus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-200">Solicitações</span>
                          {typeof pendingJoinRequests === "number" && pendingJoinRequests > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs">
                              {pendingJoinRequests}
                            </Badge>
                          )}
                        </NavLink>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Subscription Card - Below Teams section */}
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <SidebarSubscriptionCard />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer section with sync indicator only */}
        <SidebarGroup className="pb-3 md:pb-2 pt-2">
          <SidebarGroupContent>
            <SidebarSyncIndicator isCollapsed={isCollapsed && !isMobile} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
