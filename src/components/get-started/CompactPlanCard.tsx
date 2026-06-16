import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Star, Building2, Crown, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/priceUtils";
import { Plan } from "@/hooks/usePlans";

interface CompactPlanCardProps {
  plan: Plan;
  isPopular?: boolean;
  isCurrent?: boolean;
  onSelect: (plan: Plan) => void;
  billingPeriod: "monthly" | "yearly";
}

export const planThemes: Record<string, {
  icon: React.ElementType;
  iconSize: string;
  gradient: string;
  iconBg: string;
  border: string;
  accentLine: string;
  btnClass: string;
  headerColor: string;
  checkBg: string;
  checkText: string;
}> = {
  starter: {
    icon: Zap,
    iconSize: "h-5 w-5",
    gradient: "from-orange-400/15 to-amber-400/10",
    iconBg: "from-orange-400 to-amber-400",
    border: "border-orange-400/30 hover:border-orange-400/60",
    accentLine: "from-orange-400 via-amber-300 to-orange-400",
    btnClass: "bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-400/20",
    headerColor: "text-orange-500",
    checkBg: "bg-orange-500/10",
    checkText: "text-orange-500",
  },
  profissional: {
    icon: Star,
    iconSize: "h-5 w-5",
    gradient: "from-primary/20 to-orange-500/15",
    iconBg: "from-primary to-orange-500",
    border: "border-primary/30 hover:border-primary/60",
    accentLine: "from-primary via-orange-400 to-primary",
    btnClass: "bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md shadow-primary/25",
    headerColor: "text-primary",
    checkBg: "bg-primary/10",
    checkText: "text-primary",
  },
  business: {
    icon: Building2,
    iconSize: "h-5 w-5",
    gradient: "from-orange-600/15 to-orange-700/10",
    iconBg: "from-orange-600 to-orange-700",
    border: "border-orange-600/30 hover:border-orange-600/60",
    accentLine: "from-orange-600 via-orange-500 to-orange-600",
    btnClass: "bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-md shadow-orange-600/20",
    headerColor: "text-orange-600",
    checkBg: "bg-orange-600/10",
    checkText: "text-orange-600",
  },
  enterprise: {
    icon: Crown,
    iconSize: "h-6 w-6",
    gradient: "from-amber-500/15 to-yellow-500/10",
    iconBg: "from-amber-500 to-yellow-500",
    border: "border-amber-500/30 hover:border-amber-500/60",
    accentLine: "from-amber-500 via-yellow-400 to-amber-500",
    btnClass: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-md shadow-amber-500/20",
    headerColor: "text-amber-500",
    checkBg: "bg-amber-500/10",
    checkText: "text-amber-500",
  },
};

export function CompactPlanCard({ plan, isPopular = false, isCurrent = false, onSelect, billingPeriod }: CompactPlanCardProps) {
  const { t } = useTranslation();
  const theme = planThemes[plan.slug] ?? planThemes.starter;
  const Icon = theme.icon;

  const yearlyPrice = Math.round(plan.price_cents * 12 * 0.8);
  const displayPrice = billingPeriod === "yearly" ? yearlyPrice / 12 : plan.price_cents;

  return (
    <Card
      className={cn(
        "group relative flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-visible cursor-pointer border-2",
        theme.border,
        isPopular && !isCurrent && "scale-[1.02] z-10 shadow-lg",
        isCurrent && "ring-2 ring-offset-2 ring-primary scale-[1.02] z-10 shadow-lg"
      )}
      onClick={() => onSelect(plan)}
    >
      {/* Top accent line - always visible */}
      <div className={cn("absolute -top-px left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r", theme.accentLine)} />

      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 shadow-lg shadow-emerald-500/30 px-3 py-0.5 text-[10px] whitespace-nowrap">
            <Check className="h-3 w-3 mr-1" />
            {t("pricing.currentPlan")}
          </Badge>
        </div>
      )}

      {/* Popular badge (only if not current) */}
      {isPopular && !isCurrent && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-primary to-orange-500 text-white border-0 shadow-lg shadow-primary/30 px-3 py-0.5 text-[10px]">
            <Sparkles className="h-3 w-3 mr-1" />
            {t("pricing.popular")}
          </Badge>
        </div>
      )}

      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-100 transition-opacity duration-500 rounded-lg",
        theme.gradient
      )} />

      <CardContent className="relative flex flex-col items-center p-4 pt-6 gap-3">
        {/* Icon */}
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-300 group-hover:scale-110",
          theme.iconBg
        )}>
          <Icon className={theme.iconSize} />
        </div>

        {/* Name */}
        <h3 className={cn("text-base font-bold", theme.headerColor)}>{plan.name}</h3>

        {/* Price */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="text-2xl font-bold">{formatPrice(displayPrice)}</span>
            <span className="text-xs text-muted-foreground">/{t("pricing.month")}</span>
          </div>
          {billingPeriod === "yearly" && (
            <p className="text-[10px] text-success font-medium mt-0.5">
              {t("pricing.yearlyDiscount")}
            </p>
          )}
        </div>

        {/* CTA */}
        <Button
          size="sm"
          className={cn("w-full font-semibold transition-all duration-300 border-0", theme.btnClass)}
        >
          {isCurrent
            ? t("pricing.currentPlan")
            : plan.slug === "enterprise"
              ? t("pricing.contactSales")
              : t("pricing.selectPlan")}
        </Button>
      </CardContent>
    </Card>
  );
}
