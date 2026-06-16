import { ReactNode, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Users, LogOut } from "lucide-react";
import { TeamSelector } from "@/components/TeamSelector";
import { supabase } from "@/integrations/supabase/client";
import authBg from "@/assets/auth-background.jpg";
import logoSoma from "@/assets/logo-soma.png";

interface RequireTeamProps {
  children: ReactNode;
}

function SelectTeamPrompt() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Background Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img 
          src={authBg} 
          alt="Background" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-secondary/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        <div className="relative z-10 flex flex-col justify-between p-8 lg:p-12 text-white h-full">
          <div>
            <img src={logoSoma} alt="SoMA" className="h-12 w-auto" />
          </div>
          
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                Selecione sua
                <span className="block text-white/90">equipe de trabalho</span>
              </h1>
              <p className="text-lg text-white/80 max-w-md">
                Você faz parte de múltiplas equipes. Escolha com qual deseja trabalhar agora.
              </p>
            </div>
            
            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i}
                    className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center"
                  >
                    <Users className="w-5 h-5 text-white/80" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-white/70">
                Suas equipes estão esperando
              </p>
            </div>
          </div>
          
          <div className="text-sm text-white/60">
            © 2024 SoMA. Todos os direitos reservados.
          </div>
        </div>
      </div>

      {/* Right side - Team Selection */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={logoSoma} alt="SoMA" className="h-10 w-auto" />
          </div>

          <div className="text-center space-y-2">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
              Selecione uma Equipe
            </h2>
            <p className="text-muted-foreground">
              Escolha com qual equipe você deseja trabalhar agora.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <TeamSelector />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  ou
                </span>
              </div>
            </div>

            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RequireTeam({ children }: RequireTeamProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasTeams, selectedTeamId, isLoading: teamsLoading } = useSelectedTeam();
  const { data: userRole, isLoading: roleLoadingRaw, fetchStatus: roleFetchStatus } = useUserRole();

  // Only treat role query as loading when it's actually fetching (avoid pending+idle deadlock)
  const roleLoading = !!user && roleLoadingRaw && roleFetchStatus !== "idle";
  // Same for teams: only loading if user is logged in and the query is actively fetching
  const isLoading = !!user && teamsLoading;

  // Safety timeout: if we've been "loading" for >8s, just let user through to avoid being stuck forever
  const [forceContinue, setForceContinue] = useState(false);
  useEffect(() => {
    if (!authLoading && (isLoading || roleLoading)) {
      const t = setTimeout(() => setForceContinue(true), 8000);
      return () => clearTimeout(t);
    }
    setForceContinue(false);
  }, [authLoading, isLoading, roleLoading]);

  // Show loading while checking auth, teams, and role
  if (authLoading || ((isLoading || roleLoading) && !forceContinue)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // System admin should access admin panel — but only if they have no team to work with.
  // If a system admin also belongs to a team, they can use the regular app via /admin manually.
  // CRITICAL: never trap admins without a team in /admin; let them through to /welcome instead.
  if (userRole === "admin" && hasTeams) {
    return <Navigate to="/admin" replace />;
  }

  // Redirect to welcome if user has no teams (regardless of role).
  // This prevents users — including misclassified admins — from being stuck on a loading screen.
  if (!hasTeams) {
    return <Navigate to="/welcome" replace />;
  }

  // Show select team prompt if no team selected
  if (!selectedTeamId) {
    return <SelectTeamPrompt />;
  }

  return <>{children}</>;
}
