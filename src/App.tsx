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
import { lazy, Suspense, useEffect } from "react";

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
      staleTime: 3 * 60 * 1000, // 3 minutes — avoid refetching on every nav
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
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
                            <Toaster position="top-right" richColors />
                            <CommandMenu />
                            <PWAInstallPrompt />
                            <CreateDemandGlobal />
                            <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center" />}>
                            <Routes>
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/get-started" element={<GetStarted />} />
                              <Route path="/shared/:token" element={<SharedDemand />} />
                              <Route path="/shared/note/:token" element={<SharedNote />} />
                              <Route path="/shared/summary/:token" element={<SharedBoardSummary />} />
                              <Route path="/reset-password" element={<ResetPassword />} />
                              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                              <Route path="/terms-of-service" element={<TermsOfService />} />

                              <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
                                <Route index element={<AdminDashboard />} />
                                <Route path="plans" element={<AdminPlans />} />
                                <Route path="coupons" element={<AdminCoupons />} />
                                <Route path="teams" element={<AdminTeams />} />
                                <Route path="users" element={<AdminUsers />} />
                                <Route path="profile" element={<AdminProfile />} />
                              </Route>

                              <Route path="/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
                              <Route path="/complete-profile" element={<RequireAuth><CompleteProfile /></RequireAuth>} />
                              <Route path="/teams/create" element={<RequireAuth><CreateTeam /></RequireAuth>} />
                              <Route path="/teams/join" element={<RequireAuth><JoinTeam /></RequireAuth>} />
                              <Route path="/subscription/success" element={<RequireAuth><SubscriptionSuccess /></RequireAuth>} />

                              <Route element={<RequireTeam><ProtectedLayout /></RequireTeam>}>
                                <Route path="/" element={<Index />} />
                                <Route path="/teams" element={<Teams />} />
                                <Route path="/teams/:id" element={<TeamDetail />} />
                                <Route path="/teams/:id/requests" element={<TeamRequests />} />
                                <Route path="/teams/:id/services" element={<ServicesManagement />} />
                                <Route path="/boards" element={<Boards />} />
                                <Route path="/boards/:boardId" element={<BoardDetail />} />
                                <Route path="/boards/:boardId/members" element={<BoardMembers />} />
                                <Route path="/team-config" element={<TeamConfig />} />
                                <Route path="/demands" element={<Demands />} />
                                <Route path="/folders/:folderId" element={<FolderDetail />} />
                                <Route path="/projects" element={<Projects />} />
                                <Route path="/projects/:folderId" element={<FolderDetail />} />
                                <Route path="/demands/create" element={<CreateDemandRoute />} />
                                <Route path="/demands/request" element={<CreateDemandRequest />} />
                                <Route path="/demands/:id" element={<DemandDetail />} />
                                <Route path="/demand-requests" element={<DemandRequests />} />
                                <Route path="/store" element={<Store />} />
                                <Route path="/kanban" element={<Kanban />} />
                                <Route path="/time-management" element={<TimeManagement />} />
                                <Route path="/board-summary" element={<BoardSummary />} />
                                <Route path="/user/:userId" element={<UserProfile />} />
                                <Route path="/team-demands" element={<TeamDemands />} />
                                <Route path="/my-demands" element={<MyDemands />} />
                                <Route path="/notes" element={<Notes />} />
                                <Route path="/notes/:noteId" element={<NoteDetail />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/pricing" element={<Pricing />} />
                              </Route>

                              <Route path="*" element={<NotFound />} />
                            </Routes>
                            </Suspense>
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

export default App;
