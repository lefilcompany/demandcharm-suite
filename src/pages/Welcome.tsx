import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Plus, Users, ArrowRight, Sparkles } from "lucide-react";
import logoSomaDark from "@/assets/logo-soma-dark.png";
import authBackground from "@/assets/auth-background.jpg";
import { SEOHead } from "@/components/SEOHead";

export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { hasTeams, isLoading } = useSelectedTeam();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  // Check if OAuth user needs to complete profile (only for non-email providers)
  useEffect(() => {
    if (!user) {
      setCheckingProfile(false);
      return;
    }

    // Only check profile completion for OAuth users (Google, etc.)
    // Email users already provide phone/state/city during signup
    const provider = user.app_metadata?.provider;
    if (provider === "email") {
      setCheckingProfile(false);
      return;
    }

    const checkProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone, state, city")
        .eq("id", user.id)
        .single();
      
      // Only mark as incomplete if ALL three fields are missing/empty
      // If at least some data exists, the profile was partially completed
      const phoneMissing = !data?.phone || data.phone.trim() === "";
      const stateMissing = !data?.state || data.state.trim() === "";
      const cityMissing = !data?.city || data.city.trim() === "";
      
      if (phoneMissing && stateMissing && cityMissing) {
        setProfileIncomplete(true);
      }
      setCheckingProfile(false);
    };
    checkProfile();
  }, [user]);

  const { data: userRole, isLoading: roleLoading } = useUserRole();

  // Show loading while checking teams
  if (isLoading || checkingProfile || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SEOHead title="Bem-vindo" path="/welcome" />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect system admins to admin panel
  if (userRole === "admin") {
    return <Navigate to="/admin" replace />;
  }

  // Redirect to complete profile if missing fields
  if (profileIncomplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  // If user already has teams, redirect to home
  if (hasTeams) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
    
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Mobile/Tablet Header with Image */}
      <div 
        className="lg:hidden relative h-48 sm:h-56 overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-6 text-center">
          <img src={logoSomaDark} alt="SoMA" className="h-10 sm:h-12 w-auto mb-3" />
          <h2 className="text-lg sm:text-xl font-semibold">
            {t("welcome.title")}
          </h2>
        </div>
      </div>

      {/* Desktop Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <img src={logoSomaDark} alt="SoMA" className="h-12 w-auto" />
          </div>
          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wide">{t("toast.success")}</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight">
              {t("welcome.title")}
            </h1>
            <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
              {t("welcome.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border-2 border-white/30" />
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border-2 border-white/30" />
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border-2 border-white/30" />
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border-2 border-white/30 flex items-center justify-center text-sm font-medium">
                +50
              </div>
            </div>
            <p className="text-white/80 text-sm">
              {t("teams.title")}
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 lg:w-1/2 xl:w-2/5 flex items-start lg:items-center justify-center p-6 sm:p-8 md:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-6 sm:mb-8 text-center lg:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {t("welcome.subtitle")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t("common.actions")}
            </p>
          </div>

          <div className="space-y-4">
            {/* Create Team Option */}
            <button
              onClick={() => navigate("/teams/create")}
              className="group w-full bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border-2 border-primary/20 hover:border-primary/40 rounded-2xl p-5 text-left transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Plus className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                    {t("welcome.createTeamOption")}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("welcome.createTeamDesc")}
                  </p>
                </div>
              </div>
            </button>

            {/* Join Team Option */}
            <button
              onClick={() => navigate("/teams/join")}
              className="group w-full bg-muted/50 hover:bg-muted border-2 border-border hover:border-primary/30 rounded-2xl p-5 text-left transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all duration-300">
                  <Users className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                    {t("welcome.joinTeamOption")}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("welcome.joinTeamDesc")}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Logout Button */}
          <div className="mt-8 pt-6 border-t border-border text-center">
            <Button 
              variant="ghost" 
              onClick={async () => {
                await signOut();
                navigate("/auth", { replace: true });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("auth.logout")}
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
