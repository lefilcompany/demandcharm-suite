import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, ShieldCheck, CreditCard, Check, X, Users } from "lucide-react";
import { Plan } from "@/hooks/usePlans";
import { generateAccessCode } from "@/hooks/useTeams";
import { formatPrice } from "@/lib/priceUtils";
import { planThemes } from "./CompactPlanCard";
import { cn } from "@/lib/utils";

interface ConfirmStepProps {
  selectedPlan: Plan | null;
  teamData: { name: string; description: string; accessCode: string };
  onBackToPlan: () => void;
  onBackToTeam: () => void;
  onFinish: (teamData: { name: string; description: string; accessCode: string }) => void;
  isProcessing: boolean;
  currentPlanSlug?: string | null;
  existingTeamId?: string | null;
}

export function ConfirmStep({ selectedPlan, teamData, onBackToPlan, onBackToTeam, onFinish, isProcessing, currentPlanSlug, existingTeamId }: ConfirmStepProps) {
  const { t } = useTranslation();
  
  const isUpgrade = !!currentPlanSlug && selectedPlan && currentPlanSlug !== selectedPlan.slug;
  const hasExistingTeam = !!existingTeamId;

  const handleSubmit = () => {
    onFinish(teamData);
  };

  if (!selectedPlan) return null;

  const theme = planThemes[selectedPlan.slug] ?? planThemes.starter;
  const Icon = theme.icon;

  const specRows = [
    { label: t("pricing.features.boards"), value: selectedPlan.max_boards === -1 ? t("pricing.features.unlimited") : `${selectedPlan.max_boards}` },
    { label: t("pricing.features.members"), value: selectedPlan.max_members === -1 ? t("pricing.features.unlimited") : `${selectedPlan.max_members}` },
    { label: t("pricing.features.demands"), value: selectedPlan.max_demands_per_month === -1 ? t("pricing.features.unlimited") : `${selectedPlan.max_demands_per_month}` },
    { label: t("pricing.features.notes"), value: selectedPlan.max_notes === -1 ? t("pricing.features.unlimited") : `${selectedPlan.max_notes}` },
    { label: t("pricing.features.services"), value: selectedPlan.max_services === -1 ? t("pricing.features.unlimited") : `${selectedPlan.max_services}` },
  ];

  const featureChecks = [
    { label: t("pricing.features.timeTracking"), included: selectedPlan.features.time_tracking === "full" || selectedPlan.slug === "business" || selectedPlan.slug === "enterprise" },
    { label: t("pricing.features.aiSummary"), included: !!selectedPlan.features.ai_summary || selectedPlan.slug === "business" || selectedPlan.slug === "enterprise" },
    { label: t("pricing.features.externalShare"), included: !!selectedPlan.features.share_external || selectedPlan.slug === "business" || selectedPlan.slug === "enterprise" },
    { label: t("pricing.features.reports"), included: !!selectedPlan.features.reports || selectedPlan.slug === "business" || selectedPlan.slug === "enterprise" },
    { label: t("pricing.features.api"), included: !!selectedPlan.features.api || selectedPlan.slug === "enterprise" },
    { label: t("pricing.features.sla"), included: !!selectedPlan.features.sla || selectedPlan.slug === "enterprise" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold">
          {isUpgrade ? t("getStarted.upgradeTitle") : t("getStarted.confirmTitle")}
        </h2>
        <p className="text-muted-foreground">
          {isUpgrade ? t("getStarted.upgradeSubtitle") : t("getStarted.confirmSubtitle")}
        </p>
      </div>

      {/* Team summary - show when creating new team */}
      {!hasExistingTeam && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold">{t("getStarted.teamInfo")}</h3>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={onBackToTeam}>
                {t("common.edit")}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t("createTeam.teamName")}:</span>
                <p className="font-medium">{teamData.name}</p>
              </div>
              {teamData.description && (
                <div>
                  <span className="text-muted-foreground">{t("common.description")}:</span>
                  <p className="font-medium line-clamp-2">{teamData.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Plan Card with specs */}
      <Card className={cn("relative overflow-hidden border-2 transition-all", theme.border)}>
        {/* Accent line */}
        <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", theme.accentLine)} />
        
        {/* Background gradient */}
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", theme.gradient)} />
        
        <CardContent className="relative p-5 sm:p-6">
          {/* Plan header */}
          <div className="flex items-center gap-4 mb-5">
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
              theme.iconBg
            )}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className={cn("text-xl font-bold", theme.headerColor)}>{selectedPlan.name}</h3>
              {selectedPlan.description && (
                <p className="text-sm text-muted-foreground">{selectedPlan.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{formatPrice(selectedPlan.price_cents)}</span>
                <span className="text-sm text-muted-foreground">/{t("pricing.month")}</span>
              </div>
            </div>
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {specRows.map((spec, idx) => (
              <div key={idx} className="rounded-lg bg-background/60 border border-border/30 p-3 text-center">
                <p className={cn("text-lg font-bold", theme.headerColor)}>{spec.value}</p>
                <p className="text-xs text-muted-foreground">{spec.label}</p>
              </div>
            ))}
          </div>

          {/* Feature checks */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {featureChecks.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {feature.included ? (
                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center", theme.checkBg, theme.checkText)}>
                    <Check className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground/30 flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </div>
                )}
                <span className={cn("text-sm", feature.included ? "text-foreground" : "text-muted-foreground/50")}>
                  {feature.label}
                </span>
              </div>
            ))}
          </div>

          {/* Edit plan button */}
          <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={onBackToPlan}>
            {t("getStarted.changePlan")}
          </Button>
        </CardContent>
      </Card>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        <span>{t("getStarted.securePayment")}</span>
      </div>

      {/* Submit button */}
      <Button
        className={cn("w-full h-14 text-base font-semibold shadow-lg border-0", theme.btnClass)}
        onClick={handleSubmit}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t("getStarted.processingCheckout")}
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            {isUpgrade ? t("getStarted.upgradeAndPay") : t("getStarted.finishAndPay")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onBackToPlan}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("getStarted.backToPlans")}
      </Button>
    </div>
  );
}
