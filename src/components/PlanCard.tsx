import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Star, Zap, Building2, Crown, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/priceUtils";
import { Plan } from "@/hooks/usePlans";

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  onSelect?: (plan: Plan) => void;
  isLoading?: boolean;
  billingPeriod?: "monthly" | "yearly";
}

export function PlanCard({
  plan,
  isCurrentPlan = false,
  isPopular = false,
  onSelect,
  isLoading = false,
  billingPeriod = "monthly",
}: PlanCardProps) {
  const { t } = useTranslation();

  const getIcon = () => {
    switch (plan.slug) {
      case "starter":
        return <Zap className="h-5 w-5" />;
      case "profissional":
        return <Star className="h-5 w-5" />;
      case "business":
        return <Building2 className="h-5 w-5" />;
      case "enterprise":
        return <Crown className="h-6 w-6" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  const getGradient = () => {
    switch (plan.slug) {
      case "starter":
        return "from-blue-500/10 to-cyan-500/10";
      case "profissional":
        return "from-primary/20 to-orange-500/10";
      case "business":
        return "from-purple-500/10 to-pink-500/10";
      case "enterprise":
        return "from-amber-500/10 to-yellow-500/10";
      default:
        return "from-primary/10 to-accent/10";
    }
  };

  const getIconBg = () => {
    switch (plan.slug) {
      case "starter":
        return "from-blue-500 to-cyan-500";
      case "profissional":
        return "from-primary to-orange-500";
      case "business":
        return "from-purple-500 to-pink-500";
      case "enterprise":
        return "from-amber-500 to-yellow-500";
      default:
        return "from-primary to-accent";
    }
  };

  const isPremiumPlan = plan.slug === "business" || plan.slug === "enterprise";
  const isEnterprise = plan.slug === "enterprise";

  const features = [
    {
      label: plan.max_boards === -1 ? t("pricing.features.unlimited") : `${plan.max_boards} ${t("pricing.features.boards")}`,
      included: true,
    },
    {
      label: plan.max_members === -1 ? t("pricing.features.unlimited") : `${plan.max_members} ${t("pricing.features.members")}`,
      included: true,
    },
    {
      label: plan.max_demands_per_month === -1 ? t("pricing.features.unlimited") : `${plan.max_demands_per_month} ${t("pricing.features.demands")}`,
      included: true,
    },
    {
      label: t("pricing.features.timeTracking"),
      included: true,
      detail: plan.features.time_tracking === "full" || isPremiumPlan ? t("pricing.features.full") : t("pricing.features.basic"),
    },
    {
      label: t("pricing.features.notifications"),
      included: isPremiumPlan || plan.features.notifications !== "in_app",
      detail: isPremiumPlan || plan.features.notifications === "push_email" || plan.features.notifications === "all" ? "Push + Email" : "In-app",
    },
    {
      label: t("pricing.features.reports"),
      included: isPremiumPlan || !!plan.features.reports,
      detail: isPremiumPlan ? "advanced" : plan.features.reports,
    },
    {
      label: t("pricing.features.aiSummary"),
      included: isPremiumPlan || !!plan.features.ai_summary,
    },
    {
      label: t("pricing.features.externalShare"),
      included: isPremiumPlan || !!plan.features.share_external,
    },
    {
      label: t("pricing.features.api"),
      included: isPremiumPlan || !!plan.features.api,
    },
    {
      label: t("pricing.features.sla"),
      included: isEnterprise || !!plan.features.sla,
    },
  ];

  const yearlyPrice = Math.round(plan.price_cents * 12 * 0.8);
  const displayPrice = billingPeriod === "yearly" ? yearlyPrice / 12 : plan.price_cents;
  const monthlyEquivalent = billingPeriod === "yearly" ? plan.price_cents : null;

  return (
    <Card
      className={cn(
        "group relative flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 overflow-visible",
        isPopular && "ring-2 ring-primary shadow-xl shadow-primary/10 scale-[1.02] z-10",
        isCurrentPlan && "ring-2 ring-success shadow-xl shadow-success/10",
        !isPopular && !isCurrentPlan && "hover:shadow-xl hover:border-primary/30"
      )}
    >
      {/* Background Gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        getGradient()
      )} />

      {/* Popular/Current Badge */}
      {(isPopular || isCurrentPlan) && (
        <div className={cn(
          "absolute -top-px left-0 right-0 h-1 bg-gradient-to-r",
          isCurrentPlan ? "from-success via-emerald-400 to-success" : "from-primary via-orange-400 to-primary"
        )} />
      )}

      {isPopular && !isCurrentPlan && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-primary to-orange-500 text-white border-0 shadow-lg shadow-primary/30 px-4 py-1">
            <Sparkles className="h-3 w-3 mr-1" />
            {t("pricing.popular")}
          </Badge>
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-success to-emerald-500 text-white border-0 shadow-lg shadow-success/30 px-4 py-1">
            <Check className="h-3 w-3 mr-1" />
            {t("pricing.currentPlan")}
          </Badge>
        </div>
      )}

      <CardHeader className="relative text-center pb-2 pt-8">
        <div className={cn(
          "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-110",
          getIconBg()
        )}>
          {getIcon()}
        </div>
        <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
        <CardDescription className="min-h-[44px] text-sm">{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col pt-2">
        {/* Price Section */}
        <div className="mb-6 text-center py-4 rounded-2xl bg-muted/30">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {formatPrice(displayPrice)}
            </span>
            <span className="text-muted-foreground font-medium">/{t("pricing.month")}</span>
          </div>
          {billingPeriod === "yearly" && monthlyEquivalent && (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-muted-foreground line-through">
                {formatPrice(monthlyEquivalent)}/mês
              </p>
              <p className="text-xs text-success font-medium">
                Economia de {formatPrice(monthlyEquivalent * 12 - yearlyPrice)}/ano
              </p>
            </div>
          )}
          {billingPeriod === "yearly" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("pricing.billedYearly", { total: formatPrice(yearlyPrice) })}
            </p>
          )}
        </div>

        {/* CTA Button */}
        <Button
          className={cn(
            "w-full h-14 text-xs sm:text-sm font-bold tracking-wide uppercase mb-6 px-2",
            "bg-gradient-to-r from-primary via-orange-500 to-primary bg-[length:200%_100%] bg-left",
            "text-white border-0 shadow-xl shadow-primary/40",
            "hover:bg-right hover:shadow-2xl hover:shadow-primary/60 hover:-translate-y-0.5 hover:scale-[1.02]",
            "transition-all duration-500 ease-out",
            "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
            isCurrentPlan && "bg-gradient-to-r from-success via-emerald-500 to-success shadow-success/40 ring-success/30 hover:shadow-success/60"
          )}
          onClick={() => onSelect?.(plan)}
          disabled={isCurrentPlan || isLoading}
        >
          {isCurrentPlan ? (
            <>
              <Check className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">{t("pricing.currentPlan")}</span>
            </>
          ) : plan.slug === "enterprise" ? (
            <>
              <Sparkles className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">{t("pricing.contactSales")}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="truncate">{t("pricing.selectPlan")}</span>
            </>
          )}
        </Button>



        {/* Features List */}
        <ul className="flex-1 space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center",
                feature.included 
                  ? "bg-success/10 text-success" 
                  : "bg-muted text-muted-foreground/40"
              )}>
                {feature.included ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm leading-tight",
                  !feature.included && "text-muted-foreground/50"
                )}
              >
                {feature.label}
                {feature.detail && feature.included && (
                  <span className="ml-1 text-xs text-muted-foreground">({feature.detail})</span>
                )}
              </span>
            </li>
          ))}
        </ul>

      </CardContent>
    </Card>
  );
}
