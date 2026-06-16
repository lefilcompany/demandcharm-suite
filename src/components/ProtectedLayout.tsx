import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BoardSelector } from "@/components/BoardSelector";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { RotateCcw, LogOut, User, Users, Settings, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FloatingCreateButton } from "@/components/FloatingCreateButton";
import { SideCreateDemandButton } from "@/components/SideCreateDemandButton";
import { TopbarCreateButton } from "@/components/TopbarCreateButton";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useDataPrecache } from "@/hooks/useDataPrecache";
import { TrialExpiredBlock } from "@/components/TrialExpiredBlock";
import { NoBoardsScreen } from "@/components/NoBoardsScreen";
import logoSomaBlack from "@/assets/logo-soma-black.png";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useTeamSubscription } from "@/hooks/useSubscription";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import logoSomaIcon from "@/assets/logo-soma-logout.png";
import { NotificationToastStack } from "@/components/NotificationToastStack";

export function ProtectedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { isOpen, steps, closeTour, completeOnboarding, resetOnboarding, hasCompleted } = useOnboarding();
  const { currentTeam } = useSelectedTeam();
  const { hasBoards, isLoading: boardsLoading } = useSelectedBoardSafe();

  // Trial and subscription status
  // IMPORTANT: React Query keeps isLoading=true when `enabled: false` (status pending).
  // We must only treat it as loading when the query is actually fetching for a real team id.
  const { isTrialExpired, isLoading: trialLoadingRaw } = useTrialStatus();
  const { data: subscription, isLoading: subLoadingRaw, fetchStatus: subFetchStatus } = useTeamSubscription(currentTeam?.id);
  const trialLoading = !!currentTeam?.id && trialLoadingRaw;
  const subLoading = !!currentTeam?.id && subLoadingRaw && subFetchStatus !== "idle";

  // Initialize data precaching for offline support
  useDataPrecache();

  // Pré-carrega o ícone do modal de logout para que apareça instantaneamente quando o diálogo abrir
  useEffect(() => {
    const img = new Image();
    img.src = logoSomaIcon;
  }, []);

  // Detect if tablet/medium screen to collapse sidebar by default
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      return width >= 768 && width < 1280;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1280);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  // Sidebar starts collapsed on tablet, open on desktop
  const defaultSidebarOpen = !isTablet;

  // Check if user can use the system
  // Fail-open when billing data is missing so the app doesn't become unavailable
  const hasSubscriptionRecord = subscription !== null && subscription !== undefined;
  const hasActiveSubscription = subscription?.status === "active";
  const hasActiveTrialing = subscription?.status === "trialing" && !isTrialExpired;
  const isBillingBlocked = hasSubscriptionRecord && !hasActiveSubscription && !hasActiveTrialing;
  const canUseSystem = !currentTeam || !hasSubscriptionRecord || !isBillingBlocked;

  // Show loading while checking trial/subscription status
  if (trialLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show trial expired block if user cannot use the system
  if (!canUseSystem) {
    return <TrialExpiredBlock />;
  }

  // Show no-boards screen when user has no boards (except profile/settings)
  const allowedWithoutBoards = ["/profile", "/settings", "/teams", "/boards"];
  const isAllowedRoute = allowedWithoutBoards.some(r => location.pathname.startsWith(r));
  if (!boardsLoading && !hasBoards && !isAllowedRoute) {
    return <NoBoardsScreen />;
  }

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} key={isTablet ? "tablet" : "desktop"}>
      <div className="flex flex-1 min-h-0 w-full bg-sidebar p-2.5 md:p-3 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col bg-background rounded-xl shadow-xl overflow-hidden min-h-0">
          <header className="flex h-10 sm:h-11 shrink-0 items-center justify-between gap-1 sm:gap-2 bg-background px-2 sm:px-3 md:px-5 border-b border-border rounded-t-xl overflow-visible">
            <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
              <img
                src={logoSomaBlack}
                alt="SoMA"
                className="h-8 w-auto hidden md:block lg:hidden dark:hidden"
                decoding="sync"
                loading="eager"
              />
              <img
                src="/logo-soma-sidebar.png"
                alt="SoMA"
                className="h-8 w-auto hidden dark:md:block dark:lg:hidden"
                decoding="sync"
                loading="eager"
              />
              <SidebarTrigger className="text-foreground hover:bg-muted shrink-0 h-7 w-7" />
              {(() => {
                const p = location.pathname;
                const isTeamView = p === "/team-demands" || p === "/boards" || p.startsWith("/boards/") || p === "/teams" || p.startsWith("/teams/");
                if (isTeamView) return null;
                return (
                  <>
                    <div className="h-4 w-px bg-border hidden lg:block" />
                    <BoardSelector />
                  </>
                );
              })()}
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <TopbarCreateButton />

              <div className="h-4 w-px bg-border hidden sm:block" />

              <GlobalSearchBar />

              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              <div data-tour="notifications-btn">
                <NotificationDropdown />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-7 w-7 rounded-full p-0">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || "Perfil"} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl shadow-lg border bg-popover/95 backdrop-blur-sm animate-slide-up-fade"
                >
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{profile?.full_name || "Usuário"}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="h-4 w-4 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="sm:hidden"
                    onSelect={(e) => {
                      e.preventDefault();
                      setTheme(theme === "dark" ? "light" : "dark");
                    }}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 mr-2" />
                    ) : (
                      <Moon className="h-4 w-4 mr-2" />
                    )}
                    Alternar tema
                  </DropdownMenuItem>
                  {hasCompleted && (
                    <DropdownMenuItem onClick={() => resetOnboarding(() => navigate("/"))}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rever Tour Guiado
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setLogoutDialogOpen(true)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto min-h-0 p-3 md:p-6">
            <Outlet />
          </div>
          <FloatingCreateButton />
        </main>
      </div>

      {/* Real-time animated notification toast stack */}
      <NotificationToastStack />

      {/* Onboarding Tour */}
      <OnboardingTour steps={steps} isOpen={isOpen} onClose={closeTour} onComplete={completeOnboarding} />

      {/* Logout confirmation dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent className="sm:max-w-lg p-8 rounded-2xl border-border/60 shadow-2xl">
          <div className="flex flex-col items-center text-center pt-2 pb-2 relative">
            <div className="absolute top-4 h-32 w-32 rounded-full bg-primary/5 blur-2xl -z-10" />
            <div className="mb-6 flex items-center justify-center">
              <img src={logoSomaIcon} alt="SoMA+" loading="eager" decoding="sync" fetchPriority="high" className="h-20 w-auto object-contain drop-shadow-sm" />
            </div>
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-2xl font-semibold tracking-tight">
                Já vai? Vamos sentir sua falta 🧡
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base leading-relaxed text-muted-foreground max-w-sm mx-auto">
                Suas demandas, quadros e progresso ficarão te esperando quando voltar.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-center gap-3 pt-4">
            <AlertDialogCancel className="mt-0 flex-1 sm:flex-initial sm:min-w-[180px] h-12 rounded-full font-medium border-border hover:bg-muted transition-all">
              Ficar mais um pouco
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={async () => {
                setLogoutDialogOpen(false);
                await signOut();
              }}
              className="flex-1 sm:flex-initial sm:min-w-[180px] h-12 rounded-full font-medium shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              <LogOut className="h-4 w-4" />
              {t("auth.logout")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
