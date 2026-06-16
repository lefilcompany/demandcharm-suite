import { useState, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCreateTeam } from "@/hooks/useTeams";
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { useRedeemCoupon } from "@/hooks/useTrialCoupon";
import { GetStartedHero } from "@/components/get-started/GetStartedHero";
import { AuthStep } from "@/components/get-started/AuthStep";
import { TeamStep } from "@/components/get-started/TeamStep";

export default function GetStarted() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: userSub, isLoading: subLoading } = useUserSubscription();
  const createTeam = useCreateTeam();
  const redeemCoupon = useRedeemCoupon();

  const existingTeamId = userSub?.teamId ?? null;

  const [teamData, setTeamData] = useState<{ name: string; description: string; accessCode: string } | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // If user is already authenticated and has a team, jump straight to the app
  useEffect(() => {
    if (user && existingTeamId) {
      navigate("/", { replace: true });
    }
  }, [user, existingTeamId, navigate]);

  // Create the team (and optionally redeem coupon), then go to the app.
  // The 3-day trial subscription is created automatically by a DB trigger.
  const finalizeTeamCreation = async (
    finalTeamData: { name: string; description: string; accessCode: string },
    coupon?: string | null,
  ) => {
    setIsProcessing(true);
    try {
      const team = await createTeam.mutateAsync({
        name: finalTeamData.name,
        description: finalTeamData.description,
        accessCode: finalTeamData.accessCode,
      });

      if (coupon) {
        const result = await redeemCoupon.mutateAsync({ code: coupon, teamId: team.id });
        toast.success("Teste grátis ativado!", {
          description: `${result.trial_days} dias do plano ${result.plan_name}`,
        });
      } else {
        toast.success("Equipe criada!", {
          description: "Você tem 3 dias de teste gratuito com acesso completo.",
        });
      }

      navigate("/", { replace: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao criar equipe";
      toast.error(msg);
      setIsProcessing(false);
    }
  };

  // Step 1: TeamStep submitted. If not logged in, show auth and remember data.
  const handleTeamNext = (data: { name: string; description: string; accessCode: string }, coupon?: string) => {
    setTeamData(data);
    setCouponCode(coupon || null);
    if (!user) {
      setShowAuth(true);
    } else {
      finalizeTeamCreation(data, coupon);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const handleSignUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/get-started`,
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
    if (teamData) {
      finalizeTeamCreation(teamData, couponCode);
    }
  };

  // Auth completed via OAuth redirect / async session refresh
  useEffect(() => {
    if (user && showAuth && teamData) {
      setShowAuth(false);
      finalizeTeamCreation(teamData, couponCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showAuth]);

  if (authLoading || (user && subLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
            <Loader2 className="h-12 w-12 animate-spin text-primary absolute inset-0" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium">Configurando sua equipe...</p>
          <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (showAuth && !user) {
      return (
        <AuthStep
          selectedPlan={null}
          onBack={() => {
            setShowAuth(false);
            setCouponCode(null);
          }}
          onLoginSuccess={() => {
            toast.success(t("toast.success"), { description: t("auth.welcomeBack") });
            handleAuthSuccess();
          }}
          onSignupSuccess={() => {
            toast.success(t("toast.success"), { description: t("getStarted.accountCreated") });
            handleAuthSuccess();
          }}
          signIn={handleSignIn}
          signUp={handleSignUp}
        />
      );
    }

    return <TeamStep initialData={teamData || undefined} onNext={handleTeamNext} />;
  };

  return (
    <>
      <SEOHead
        title="Comece Agora"
        description="Crie sua equipe e ganhe 3 dias de teste gratuito do SoMA para gerenciar demandas de marketing."
        path="/get-started"
      />
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-background">
        <GetStartedHero />
        <div className="flex-1 lg:w-3/5 xl:w-[55%] flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center p-4 sm:p-6 lg:p-6 xl:p-8 min-h-full justify-center">
              <div className="w-full max-w-5xl">{renderContent()}</div>
            </div>
          </div>
          <div className="shrink-0 py-3 px-6 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} SoMA. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
