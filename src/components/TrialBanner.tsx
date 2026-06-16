import { useTranslation } from "react-i18next";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useTeamSubscription } from "@/hooks/useSubscription";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTeam } = useSelectedTeam();
  const { isTrialActive, daysRemaining, isLoading: trialLoading } = useTrialStatus();
  const { data: subscription, isLoading: subLoading } = useTeamSubscription(currentTeam?.id);

  // Don't show if loading
  if (trialLoading || subLoading) return null;

  // Don't show if team has active subscription
  if (subscription?.status === "active") return null;

  // Don't show if trial expired (will show block instead)
  if (!isTrialActive) return null;

  // Determine urgency level based on days remaining
  const getUrgencyStyles = () => {
    if (daysRemaining <= 3) {
      return "bg-gradient-to-r from-destructive/15 to-destructive/5 border-destructive/30 text-destructive";
    }
    if (daysRemaining <= 7) {
      return "bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400";
    }
    if (daysRemaining <= 14) {
      return "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/30 text-primary";
    }
    return "bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
  };

  const getMessage = () => {
    if (daysRemaining === 0) {
      return t("trial.lastDay");
    }
    if (daysRemaining === 1) {
      return t("trial.oneDayRemaining");
    }
    return t("trial.daysRemaining", { days: daysRemaining });
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
        getUrgencyStyles()
      )}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-background/80 backdrop-blur-sm">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t("trial.title")}</span>
            {daysRemaining <= 7 && (
              <Sparkles className="h-4 w-4 animate-pulse" />
            )}
          </div>
          <p className="text-sm opacity-90">{getMessage()}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/pricing")}
        className="gap-2 bg-background/80 hover:bg-background shrink-0"
      >
        {t("trial.viewPlans")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
