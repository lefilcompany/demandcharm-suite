import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth";
import { TeamProvider } from "@/contexts/TeamContext";
import { BoardProvider } from "@/contexts/BoardContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { CreateDemandProvider, useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { PlansModalProvider } from "@/contexts/PlansModalContext";
import { PipTimerProvider } from "@/contexts/PipTimerContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireTeam } from "@/components/RequireTeam";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Toaster } from "@/components/ui/sonner";
import { CommandMenu } from "@/components/CommandMenu";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcuts";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { SwipeNavigationProvider } from "@/components/SwipeNavigationProvider";
import { ScrollToTop } from "@/components/ScrollToTop";
import { UpdateModal } from "@/components/UpdateModal";
import { LegacyRedirect, LEGACY_APP_PATHS } from "@/components/LegacyRedirect";

import { lazy, Suspense, useEffect } from "react";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { prefetchAppRoutes } from "@/lib/routePrefetch";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const TeamRequests = lazy(() => import("./pages/TeamRequests"));
const ServicesManagement = lazy(() => import("./pages/ServicesManagement"));
const Demands = lazy(() => import("./pages/Demands"));
const CreateDemand = lazy(() => import("./pages/CreateDemand"));
const CreateDemandRequest = lazy(() => import("./pages/CreateDemandRequest"));
const CreateTeam = lazy(() => import("./pages/CreateTeam"));
const JoinTeam = lazy(() => import("./pages/JoinTeam"));
const DemandRequests = lazy(() => import("./pages/DemandRequests"));
const DemandDetail = lazy(() => import("./pages/DemandDetail"));
const SharedDemand = lazy(() => import("./pages/SharedDemand"));
const SharedNote = lazy(() => import("./pages/SharedNote"));
const SharedBoardSummary = lazy(() => import("./pages/SharedBoardSummary"));
const Kanban = lazy(() => import("./pages/Kanban"));
const BoardMembers = lazy(() => import("./pages/BoardMembers"));
const Boards = lazy(() => import("./pages/Boards"));
const BoardDetail = lazy(() => import("./pages/BoardDetail"));
const TeamConfig = lazy(() => import("./pages/TeamConfig"));
const Reports = lazy(() => import("./pages/Reports"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TimeManagement = lazy(() => import("./pages/TimeManagement"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const BoardSummary = lazy(() => import("./pages/BoardSummary"));
const BoardAgent = lazy(() => import("./pages/BoardAgent"));
const Store = lazy(() => import("./pages/Store"));
const TeamDemands = lazy(() => import("./pages/TeamDemands"));
const MyDemands = lazy(() => import("./pages/MyDemands"));
const Notes = lazy(() => import("./pages/Notes"));
const NoteDetail = lazy(() => import("./pages/NoteDetail"));
const FolderDetail = lazy(() => import("./pages/FolderDetail"));
const Projects = lazy(() => import("./pages/Projects"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/Pricing"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const GetStarted = lazy(() => import("./pages/GetStarted"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminTeams = lazy(() => import("./pages/admin/AdminTeams"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminPlans = lazy(() => import("./pages/admin/AdminPlans"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));
const AdminEmailTest = lazy(() => import("./pages/admin/AdminEmailTest"));
const AdminPushTest = lazy(() => import("./pages/admin/AdminPushTest"));
const AdminEmailLogs = lazy(() => import("./pages/admin/AdminEmailLogs"));
const AdminDemoRequests = lazy(() => import("./pages/admin/AdminDemoRequests"));
const AdminReleaseTest = lazy(() => import("./pages/admin/AdminReleaseTest"));
const AdminReleases = lazy(() => import("./pages/admin/AdminReleases"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const McpDocs = lazy(() => import("./pages/McpDocs"));
const Landing = lazy(() => import("./pages/Landing"));

function CreateDemandGlobal() {
  return <CreateDemand />;
}

function CreateDemandRoute() {
  const { openCreateDemand } = useCreateDemandModal();
  const navigate = useNavigate();

  useEffect(() => {
    openCreateDemand();
    navigate(-1);
  }, []);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const App = () => {
  useEffect(() => {
    prefetchAppRoutes();
  }, []);
  return (
  <HelmetProvider>
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <div className="flex h-[100dvh] flex-col">
            <UpdateModal />
            <div className="flex min-h-0 flex-1 flex-col">
              <ScrollToTop />
              <AuthProvider>
                <PresenceProvider>
                  <TeamProvider>
                    <BoardProvider>
                      <PlansModalProvider>
                      <CreateDemandProvider>
                        <KeyboardShortcutsProvider>
                          <SwipeNavigationProvider>
                            <PipTimerProvider>
                            <Toaster position="top-right" richColors />
                            <CommandMenu />
                            <PWAInstallPrompt />
                            <CreateDemandGlobal />
                            <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center p-6"><PageSkeleton /></div>}>
                            <Routes>
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                              <Route path="/get-started" element={<GetStarted />} />
                              <Route path="/" element={<Landing />} />
                              <Route path="/lp" element={<Landing />} />
                              <Route path="/landing" element={<Landing />} />

                              <Route path="/shared/:token" element={<SharedDemand />} />
                              <Route path="/shared/note/:token" element={<SharedNote />} />
                              <Route path="/shared/summary/:token" element={<SharedBoardSummary />} />
                              <Route path="/reset-password" element={<ResetPassword />} />
                              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                             <Route path="/terms-of-service" element={<TermsOfService />} />
                             <Route path="/mcp-docs" element={<McpDocs />} />
                             
                             

                              <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
                                <Route index element={<AdminDashboard />} />
                                <Route path="plans" element={<AdminPlans />} />
                                <Route path="coupons" element={<AdminCoupons />} />
                                <Route path="teams" element={<AdminTeams />} />
                                <Route path="users" element={<AdminUsers />} />
                                <Route path="profile" element={<AdminProfile />} />
                                <Route path="email-test" element={<AdminEmailTest />} />
                                <Route path="push-test" element={<AdminPushTest />} />
                                <Route path="email-logs" element={<AdminEmailLogs />} />
                                <Route path="demo-requests" element={<AdminDemoRequests />} />
                                <Route path="release-test" element={<AdminReleaseTest />} />
                                <Route path="releases" element={<AdminReleases />} />
                              </Route>

                              <Route path="/app/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
                              <Route path="/app/complete-profile" element={<RequireAuth><CompleteProfile /></RequireAuth>} />
                              <Route path="/app/teams/create" element={<RequireAuth><CreateTeam /></RequireAuth>} />
                              <Route path="/app/teams/join" element={<RequireAuth><JoinTeam /></RequireAuth>} />
                              <Route path="/app/subscription/success" element={<RequireAuth><SubscriptionSuccess /></RequireAuth>} />

                              <Route element={<RequireTeam><ProtectedLayout /></RequireTeam>}>
                                <Route path="/app" element={<Index />} />
                                <Route path="/app/teams" element={<Teams />} />
                                <Route path="/app/teams/:id" element={<TeamDetail />} />
                                <Route path="/app/teams/:id/requests" element={<TeamRequests />} />
                                <Route path="/app/teams/:id/services" element={<ServicesManagement />} />
                                <Route path="/app/boards" element={<Boards />} />
                                <Route path="/app/boards/:boardId" element={<BoardDetail />} />
                                <Route path="/app/boards/:boardId/members" element={<BoardMembers />} />
                                <Route path="/app/team-config" element={<TeamConfig />} />
                                <Route path="/app/demands" element={<Demands />} />
                                <Route path="/app/folders/:folderId" element={<FolderDetail />} />
                                <Route path="/app/projects" element={<Projects />} />
                                <Route path="/app/projects/:folderId" element={<FolderDetail />} />
                                <Route path="/app/demands/create" element={<CreateDemandRoute />} />
                                <Route path="/app/demands/request" element={<CreateDemandRequest />} />
                                <Route path="/app/demands/:id" element={<DemandDetail />} />
                                <Route path="/app/demand-requests" element={<DemandRequests />} />
                                <Route path="/app/store" element={<Store />} />
                                <Route path="/app/kanban" element={<Kanban />} />
                                <Route path="/app/time-management" element={<TimeManagement />} />
                                <Route path="/app/board-summary" element={<BoardSummary />} />
                                <Route path="/app/board-agent" element={<BoardAgent />} />
                                <Route path="/app/user/:userId" element={<UserProfile />} />
                                <Route path="/app/team-demands" element={<TeamDemands />} />
                                <Route path="/app/my-demands" element={<MyDemands />} />
                                <Route path="/app/notes" element={<Notes />} />
                                <Route path="/app/notes/:noteId" element={<NoteDetail />} />
                                <Route path="/app/reports" element={<Reports />} />
                                <Route path="/app/profile" element={<Profile />} />
                                <Route path="/app/settings" element={<Settings />} />
                                <Route path="/app/pricing" element={<Pricing />} />
                              </Route>

                              {LEGACY_APP_PATHS.map((p) => (
                                <Route key={p} path={`/${p}/*`} element={<LegacyRedirect />} />
                              ))}
                              {LEGACY_APP_PATHS.map((p) => (
                                <Route key={`${p}-exact`} path={`/${p}`} element={<LegacyRedirect />} />
                              ))}

                              <Route path="*" element={<NotFound />} />

                            </Routes>
                            </Suspense>
                            </PipTimerProvider>
                          </SwipeNavigationProvider>
                        </KeyboardShortcutsProvider>
                      </CreateDemandProvider>
                      </PlansModalProvider>
                    </BoardProvider>
                  </TeamProvider>
                </PresenceProvider>
              </AuthProvider>
            </div>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  </HelmetProvider>
  );
};

export default App;
