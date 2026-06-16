import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarWithStatus } from "@/components/AvatarWithStatus";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { badges as gamificationBadges } from "@/hooks/useUserStats";
import { 
  Loader2, User, Calendar, Briefcase, CheckCircle2, Clock, Edit, 
  Trophy, Target, Flame, Zap, MapPin, Link as LinkIcon,
  Github, Linkedin, TrendingUp, Award, Circle, ChevronDown, ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePresence } from "@/contexts/PresenceContext";
import { SEOHead } from "@/components/SEOHead";
import { ProfileTabsSection } from "@/components/profile/ProfileTabsSection";
import { resolveVisibility, getBannerGradient, type ProfileFieldKey } from "@/lib/profileCustomization";

const INITIAL_BADGES_COUNT = 12;

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isUserOnline } = usePresence();
  const [showAllBadges, setShowAllBadges] = useState(false);
  
  const isOwnProfile = user?.id === userId;
  const isOnline = userId ? isUserOnline(userId) : false;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Get user's teams
  const { data: userTeams } = useQuery({
    queryKey: ["user-teams", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          role,
          joined_at,
          teams:team_id (
            id,
            name
          )
        `)
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Get user's boards
  const { data: userBoards } = useQuery({
    queryKey: ["user-boards", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("board_members")
        .select(`
          role,
          boards:board_id (
            id,
            name
          )
        `)
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Get user's extended stats
  const { data: stats } = useQuery({
    queryKey: ["user-stats-extended", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      // Get demands created by user
      const { count: createdCount } = await supabase
        .from("demands")
        .select("*", { count: "exact", head: true })
        .eq("created_by", userId);
      
      // Get demands assigned to user
      const { count: assignedCount } = await supabase
        .from("demand_assignees")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      
      // Get completed demands (created OR assigned, using delivered_at as the source of truth)
      const { data: createdDelivered } = await supabase
        .from("demands")
        .select("id")
        .eq("created_by", userId)
        .not("delivered_at", "is", null);

      const { data: assignedDelivered } = await supabase
        .from("demands")
        .select("id, demand_assignees!inner(user_id)")
        .eq("demand_assignees.user_id", userId)
        .not("delivered_at", "is", null);

      const deliveredIds = new Set<string>();
      (createdDelivered || []).forEach((d: any) => deliveredIds.add(d.id));
      (assignedDelivered || []).forEach((d: any) => deliveredIds.add(d.id));
      const completedCount = deliveredIds.size;

      // Get total time tracked
      const { data: timeEntries } = await supabase
        .from("demand_time_entries")
        .select("duration_seconds")
        .eq("user_id", userId);
      
      const totalSeconds = timeEntries?.reduce((acc, entry) => acc + (entry.duration_seconds || 0), 0) || 0;

      // Get comments count
      const { count: commentsCount } = await supabase
        .from("demand_interactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("interaction_type", "comment");

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: recentActivity } = await supabase
        .from("demand_interactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString());
      
      return {
        created: createdCount || 0,
        assigned: assignedCount || 0,
        completed: completedCount,
        totalTimeSeconds: totalSeconds,
        comments: commentsCount || 0,
        recentActivity: recentActivity || 0,
      };
    },
    enabled: !!userId,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMMM 'de' yyyy", { locale: ptBR });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: "Administrador",
      moderator: "Moderador",
      executor: "Executor",
      requester: "Solicitante",
    };
    return roles[role] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive",
      moderator: "default",
      executor: "secondary",
      requester: "outline",
    };
    return variants[role] || "secondary";
  };

  // Calculate user level based on activity
  const calculateLevel = () => {
    if (!stats) return { level: 1, xp: 0, nextLevelXp: 100, progress: 0 };
    
    const xp = (stats.completed * 50) + (stats.created * 20) + (stats.comments * 5) + Math.floor(stats.totalTimeSeconds / 3600) * 10;
    let level = 1;
    let totalXpForLevel = 0;
    let xpNeeded = 100;
    
    while (xp >= totalXpForLevel + xpNeeded) {
      totalXpForLevel += xpNeeded;
      level++;
      xpNeeded = Math.floor(xpNeeded * 1.5);
    }
    
    const currentLevelXp = xp - totalXpForLevel;
    const progress = (currentLevelXp / xpNeeded) * 100;
    
    return { level, xp, nextLevelXp: xpNeeded, currentLevelXp, progress };
  };

  // Get user stats for gamification badges
  const getUserBadgeStats = () => {
    if (!stats) return null;
    const teamsCount = userTeams?.length || 0;
    const boardsCount = userBoards?.length || 0;
    
    return {
      totalDemands: stats.created,
      deliveredDemands: stats.completed,
      inProgressDemands: 0,
      totalComments: stats.comments,
      totalTimeSpent: stats.totalTimeSeconds,
      teamsCount,
      boardsCount,
      avgDeliveryTime: 0, // We don't have this data here
    };
  };

  const badgeStats = getUserBadgeStats();
  const earnedBadges = badgeStats ? gamificationBadges.filter((b) => b.requirement(badgeStats)) : [];
  const lockedBadges = badgeStats ? gamificationBadges.filter((b) => !b.requirement(badgeStats)) : gamificationBadges;

  const levelData = calculateLevel();
  const visibility = resolveVisibility((profile as any)?.profile_visibility, isOwnProfile);
  const v = (k: ProfileFieldKey) => visibility[k];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageBreadcrumb
          items={[
            { label: "Perfil do Usuário", icon: User, isCurrent: true },
          ]}
        />
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Usuário não encontrado</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <SEOHead title={profile.full_name || "Perfil do Usuário"} />
      <PageBreadcrumb
        items={[
          { label: profile?.full_name || "Perfil do Usuário", icon: User, isCurrent: true },
        ]}
      />
      {/* Header */}
      <div className="flex items-center justify-end">
        {isOwnProfile && (
          <Button onClick={() => navigate("/profile")} variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Editar Perfil
          </Button>
        )}
      </div>

      {/* Profile Hero Section */}
      <Card className="overflow-hidden shadow-lg">
        <div 
          className="relative w-full"
          style={{ aspectRatio: "4 / 1" }}
        >
          {(profile as any)?.banner_url ? (
            <>
              <img 
                src={(profile as any).banner_url} 
                alt="Banner" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Gradient overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </>
          ) : (
            <div className={`absolute inset-0 ${getBannerGradient((profile as any)?.banner_gradient).className}`}>
              {/* Pattern overlay for default banner */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          )}
          
          {/* Level Badge */}
          {v("level") && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 z-10 border border-white/10">
              <Trophy className="h-5 w-5 text-yellow-400 drop-shadow-md" />
              <span className="text-white font-bold drop-shadow-md">Nível {levelData.level}</span>
            </div>
          )}

          {/* Decorative bottom edge */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
        </div>
        <CardContent className="relative pb-6">
          {/* Avatar */}
          <div className="absolute -top-16 left-6 md:left-8">
            <div className="relative">
              <AvatarWithStatus
                userId={userId}
                src={profile.avatar_url || undefined}
                fallback={profile.full_name ? getInitials(profile.full_name) : "?"}
                className="h-28 w-28 md:h-32 md:w-32 border-4 border-background shadow-xl text-3xl"
                size="xl"
                showStatus={true}
              />
              {/* Level badge on avatar */}
              {v("level") && (
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-lg border-2 border-background">
                  {levelData.level}
                </div>
              )}
            </div>
          </div>

          {/* Profile Info Header */}
          <div className="pt-16 md:pt-20 md:pl-40">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {profile.full_name}
                </h1>
                {v("jobTitle") && (profile as any).job_title && (
                  <p className="text-primary font-medium mt-1">{(profile as any).job_title}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isOnline ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    <Circle className={`h-2 w-2 fill-current ${isOnline ? 'animate-pulse' : ''}`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Membro desde {formatDate(profile.created_at)}
                  </span>
                  {v("location") && (profile as any).location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {(profile as any).location}
                    </span>
                  )}
                </div>
                {v("bio") && (profile as any).bio && (
                  <p className="text-muted-foreground mt-3 max-w-2xl">{(profile as any).bio}</p>
                )}
              </div>
              
              {/* Social links */}
              <div className="flex items-center gap-2">
                {v("website") && (profile as any).website && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild>
                          <a href={(profile as any).website} target="_blank" rel="noopener noreferrer">
                            <LinkIcon className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Website</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {v("github") && (profile as any).github_url && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild>
                          <a href={(profile as any).github_url} target="_blank" rel="noopener noreferrer">
                            <Github className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>GitHub</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {v("linkedin") && (profile as any).linkedin_url && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild>
                          <a href={(profile as any).linkedin_url} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>LinkedIn</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* XP Progress bar */}
            {v("level") && (
              <div className="mt-6 bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Progresso para Nível {levelData.level + 1}
                  </span>
                  <span className="text-muted-foreground">
                    {levelData.currentLevelXp} / {levelData.nextLevelXp} XP
                  </span>
                </div>
                <Progress value={levelData.progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Total de {levelData.xp} XP acumulados
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {v("statDemands") && (

          <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{stats?.assigned || 0}</p>
              <p className="text-xs text-muted-foreground">Atribuídas</p>
            </div>
          </CardContent>
        </Card>

        )}

        {v("statDelivered") && (


          <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <p className="text-2xl font-bold">{stats?.completed || 0}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>


        )}

        {v("statDemands") && (


          <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-secondary" />
              </div>
              <p className="text-2xl font-bold">{stats?.created || 0}</p>
              <p className="text-xs text-muted-foreground">Criadas</p>
            </div>
          </CardContent>
        </Card>


        )}

        {v("statTime") && (


          <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-foreground" />
              </div>
              <p className="text-2xl font-bold">{formatTime(stats?.totalTimeSeconds || 0)}</p>
              <p className="text-xs text-muted-foreground">Tempo Total</p>
            </div>
          </CardContent>
        </Card>


        )}

        {v("statComments") && (


          <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{stats?.comments || 0}</p>
              <p className="text-xs text-muted-foreground">Comentários</p>
            </div>
          </CardContent>
        </Card>


        )}

        {v("statRecent") && (


          <Card className="col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center mb-2">
                <Flame className="h-5 w-5 text-warning" />
              </div>
              <p className="text-2xl font-bold">{stats?.recentActivity || 0}</p>
              <p className="text-xs text-muted-foreground">Ações (30d)</p>
            </div>
          </CardContent>
        </Card>


        )}
      </div>

      {/* Tabbed: history, achievements, teams, boards */}
      {userId && (
        <ProfileTabsSection
          userId={userId}
          isPublic={Boolean((profile as any)?.is_demand_history_public)}
          visibility={visibility}
          earnedBadges={earnedBadges}
          lockedBadges={lockedBadges}
          totalBadges={gamificationBadges.length}
          teams={(userTeams || []) as any}
          boards={(userBoards || []) as any}
          getRoleLabel={getRoleLabel}
          getRoleBadgeVariant={getRoleBadgeVariant}
        />
      )}
    </div>
  );
}
