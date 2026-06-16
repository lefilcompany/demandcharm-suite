import { useTranslation } from "react-i18next";
import { usePlans, Plan } from "@/hooks/usePlans";
import { PlanCard } from "@/components/PlanCard";
import { Button } from "@/components/ui/button";
import { LogOut, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useCreateCheckout } from "@/hooks/useCheckout";
import { toast } from "sonner";
import { useState } from "react";
import logoSoma from "@/assets/logo-soma.png";
import logoDark from "@/assets/logo-soma-dark.png";
import { useTheme } from "next-themes";

export function TrialExpiredBlock() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { data: plans, isLoading } = usePlans();
  const { resolvedTheme } = useTheme();
  const { selectedTeamId } = useSelectedTeam();
  const createCheckout = useCreateCheckout();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const logo = resolvedTheme === "dark" ? logoDark : logoSoma;

  const handleSelectPlan = async (plan: Plan) => {
    if (!selectedTeamId) {
      toast.error("Equipe não encontrada");
      return;
    }
    setLoadingSlug(plan.slug);
    try {
      const url = await createCheckout.mutateAsync({ planSlug: plan.slug, teamId: selectedTeamId });
      window.location.href = url;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao iniciar checkout";
      toast.error(msg);
      setLoadingSlug(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="p-4 md:p-6 flex justify-between items-center border-b">
        <img src={logo} alt="SoMA" className="h-8 md:h-10" />
        <Button variant="ghost" onClick={() => signOut()} className="gap-2">
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Expired Message */}
        <div className="text-center mb-8 max-w-xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {t("trial.expired")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("trial.expiredDescription")}
          </p>
          <p className="text-muted-foreground mt-2">
            {t("trial.choosePlan")}
          </p>
        </div>

        {/* Trial Info */}
        <div className="flex items-center gap-2 mb-8 px-4 py-2 bg-muted/50 rounded-full">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t("trial.freeTrialEnded")}
          </span>
        </div>

        {/* Plans Grid */}
        <div className="w-full max-w-6xl">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans?.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={false}
                  onSelect={handleSelectPlan}
                  isLoading={loadingSlug === plan.slug}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} SoMA. {t("trial.allRightsReserved")}
      </footer>
    </div>
  );
}
