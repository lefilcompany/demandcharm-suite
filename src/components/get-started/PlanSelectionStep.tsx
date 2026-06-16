import { useTranslation } from "react-i18next";
import { Plan } from "@/hooks/usePlans";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronDown, Check, X, Sparkles, Users, LayoutGrid, FileText, Clock, Bell, BarChart3, Brain, Share2, Code, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/priceUtils";
import { planThemes } from "./CompactPlanCard";

interface PlanSelectionStepProps {
  plans: Plan[] | undefined;
  onSelectPlan: (plan: Plan) => void;
  currentPlanSlug?: string | null;
  onBack?: () => void;
}

/** Smooth animated collapsible with height transition */
function AnimatedCollapsible({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ height, opacity: isOpen ? 1 : 0 }}
    >
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

function PlanFeaturesList({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const theme = planThemes[plan.slug] ?? planThemes.starter;

  const isPremium = plan.slug === "business" || plan.slug === "enterprise";
  const isEnterprise = plan.slug === "enterprise";

  const features = [
    { icon: LayoutGrid, label: t("pricing.features.boards"), value: plan.max_boards === -1 ? t("pricing.features.unlimited") : `${plan.max_boards}`, included: true },
    { icon: Users, label: t("pricing.features.members"), value: plan.max_members === -1 ? t("pricing.features.unlimited") : `${plan.max_members}`, included: true },
    { icon: FileText, label: t("pricing.features.demands"), value: plan.max_demands_per_month === -1 ? t("pricing.features.unlimited") : `${plan.max_demands_per_month}`, included: true },
    { icon: Clock, label: t("pricing.features.timeTracking"), value: isPremium || plan.features.time_tracking === "full" ? t("pricing.features.full") : t("pricing.features.basic"), included: true },
    { icon: Bell, label: t("pricing.features.notifications"), value: isPremium || plan.features.notifications === "push_email" || plan.features.notifications === "all" ? "Push + Email" : "In-app", included: true },
    { icon: BarChart3, label: t("pricing.features.reports"), value: isPremium ? "Avançado" : plan.features.reports ? String(plan.features.reports) : null, included: isPremium || !!plan.features.reports },
    { icon: Brain, label: t("pricing.features.aiSummary"), value: null, included: isPremium || !!plan.features.ai_summary },
    { icon: Share2, label: t("pricing.features.externalShare"), value: null, included: isPremium || !!plan.features.share_external },
    { icon: Code, label: t("pricing.features.api"), value: null, included: isPremium || !!plan.features.api },
    { icon: ShieldCheck, label: t("pricing.features.sla"), value: null, included: isEnterprise || !!plan.features.sla },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 py-4 px-2">
      {features.map((feat, idx) => {
        const FeatureIcon = feat.icon;
        return (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors",
              feat.included ? "hover:bg-muted/40" : "opacity-40"
            )}
          >
            <div className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
              feat.included ? theme.checkBg : "bg-muted"
            )}>
              {feat.included ? (
                <FeatureIcon className={cn("h-3.5 w-3.5", theme.checkText)} />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn("text-sm", feat.included ? "text-foreground font-medium" : "text-muted-foreground line-through")}>
                {feat.label}
              </span>
              {feat.value && feat.included && (
                <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-md", theme.checkBg, theme.checkText)}>
                  {feat.value}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PlanSelectionStep({ plans, onSelectPlan, currentPlanSlug, onBack }: PlanSelectionStepProps) {
  const { t } = useTranslation();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Billing toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{t("getStarted.step2Title")}</h2>
          <p className="text-sm text-muted-foreground">{t("getStarted.selectPlanSubtitle")}</p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 bg-muted/50 rounded-full px-4 py-2">
          <Label
            htmlFor="gs-billing-toggle"
            className={cn(
              "text-sm cursor-pointer transition-colors",
              billingPeriod === "monthly" ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            {t("pricing.monthly")}
          </Label>
          <Switch
            id="gs-billing-toggle"
            checked={billingPeriod === "yearly"}
            onCheckedChange={(checked) => setBillingPeriod(checked ? "yearly" : "monthly")}
          />
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="gs-billing-toggle"
              className={cn(
                "text-sm cursor-pointer transition-colors",
                billingPeriod === "yearly" ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {t("pricing.yearly")}
            </Label>
            <Badge className="bg-success/15 text-success border-success/30 text-[10px] font-semibold">
              {t("pricing.yearlyDiscount")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Plans list */}
      <div className="flex flex-col gap-2.5">
        {plans?.map((plan, index) => {
          const theme = planThemes[plan.slug] ?? planThemes.starter;
          const Icon = theme.icon;
          const isCurrent = plan.slug === currentPlanSlug;
          const isPopular = plan.slug === "profissional";
          const isOpen = openPlan === plan.id;

          const yearlyPrice = Math.round(plan.price_cents * 12 * 0.8);
          const displayPrice = billingPeriod === "yearly" ? yearlyPrice / 12 : plan.price_cents;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-xl border bg-card transition-all duration-300 animate-fade-in",
                isOpen
                  ? "border-primary/40 shadow-md shadow-primary/5"
                  : "border-border/60 hover:border-border",
                isCurrent && "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
                isPopular && !isOpen && "border-primary/25"
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Left accent bar */}
              <div className={cn(
                "absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b transition-opacity duration-300",
                theme.accentLine,
                isOpen ? "opacity-100" : "opacity-40"
              )} />

              {/* Main row - clickable trigger */}
              <button
                type="button"
                className="w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 pl-5 text-left cursor-pointer group"
                onClick={() => setOpenPlan(isOpen ? null : plan.id)}
              >
                {/* Icon */}
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shrink-0 transition-transform duration-200 group-hover:scale-105",
                  theme.iconBg
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">{plan.name}</h3>
                    {isCurrent && (
                      <Badge variant="outline" className="border-success/40 bg-success/10 text-success text-[10px] px-1.5 py-0 font-medium">
                        {t("pricing.currentPlan")}
                      </Badge>
                    )}
                    {isPopular && !isCurrent && (
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        {t("pricing.popular")}
                      </Badge>
                    )}
                  </div>
                  {plan.description && (
                    <p className={cn(
                      "text-xs text-muted-foreground mt-0.5 transition-all duration-300",
                      isOpen ? "whitespace-normal" : "truncate"
                    )}>{plan.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-0.5 justify-end">
                    <span className="text-lg sm:text-xl font-bold text-foreground">{formatPrice(displayPrice)}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">/{t("pricing.month")}</span>
                  </div>
                  {billingPeriod === "yearly" && (
                    <p className="text-[10px] text-success font-medium">{t("pricing.yearlyDiscount")}</p>
                  )}
                </div>

                {/* Select button (desktop) */}
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "shrink-0 font-medium hidden sm:flex text-xs h-8 px-3 transition-all duration-200",
                    "border-border/60 hover:border-primary hover:text-primary hover:bg-primary/5"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlan(plan);
                  }}
                >
                  {isCurrent
                    ? t("pricing.currentPlan")
                    : plan.slug === "enterprise"
                      ? t("pricing.contactSales")
                      : t("pricing.selectPlan")}
                </Button>

                {/* Chevron */}
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground/60 shrink-0 transition-transform duration-300",
                  isOpen && "rotate-180 text-primary"
                )} />
              </button>

              {/* Expandable details with smooth animation */}
              <AnimatedCollapsible isOpen={isOpen}>
                <div className="border-t border-border/40 mx-4" />
                <div className="px-4 pb-4">
                  <PlanFeaturesList plan={plan} />

                  {/* Mobile select button */}
                  <Button
                    className={cn("w-full font-semibold border-0 sm:hidden mt-2", theme.btnClass)}
                    onClick={() => onSelectPlan(plan)}
                  >
                    {isCurrent
                      ? t("pricing.currentPlan")
                      : plan.slug === "enterprise"
                        ? t("pricing.contactSales")
                        : t("pricing.selectPlan")}
                  </Button>
                </div>
              </AnimatedCollapsible>
            </div>
          );
        })}
      </div>

      {/* Back button */}
      {onBack && (
        <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("getStarted.backToTeam")}
        </Button>
      )}
    </div>
  );
}
