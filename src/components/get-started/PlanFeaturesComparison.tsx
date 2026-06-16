import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Plan } from "@/hooks/usePlans";
import { planThemes } from "./CompactPlanCard";

interface PlanFeaturesComparisonProps {
  plans: Plan[];
}

export function PlanFeaturesComparison({ plans }: PlanFeaturesComparisonProps) {
  const { t } = useTranslation();

  const featureRows = [
    {
      label: t("pricing.features.boards"),
      getValue: (plan: Plan) => plan.max_boards === -1 ? t("pricing.features.unlimited") : `${plan.max_boards}`,
    },
    {
      label: t("pricing.features.members"),
      getValue: (plan: Plan) => plan.max_members === -1 ? t("pricing.features.unlimited") : `${plan.max_members}`,
    },
    {
      label: t("pricing.features.demands"),
      getValue: (plan: Plan) => plan.max_demands_per_month === -1 ? t("pricing.features.unlimited") : `${plan.max_demands_per_month}`,
    },
    {
      label: t("pricing.features.timeTracking"),
      getValue: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || plan.features.time_tracking === "full" ? t("pricing.features.full") : t("pricing.features.basic");
      },
    },
    {
      label: t("pricing.features.notifications"),
      getIncluded: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || plan.features.notifications !== "in_app";
      },
      getValue: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || plan.features.notifications === "push_email" || plan.features.notifications === "all" ? "Push + Email" : "In-app";
      },
    },
    {
      label: t("pricing.features.reports"),
      getIncluded: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || !!plan.features.reports;
      },
      getValue: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        if (!isPremium && !plan.features.reports) return null;
        return isPremium ? "Avançado" : plan.features.reports;
      },
    },
    {
      label: t("pricing.features.aiSummary"),
      getIncluded: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || !!plan.features.ai_summary;
      },
    },
    {
      label: t("pricing.features.externalShare"),
      getIncluded: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || !!plan.features.share_external;
      },
    },
    {
      label: t("pricing.features.api"),
      getIncluded: (plan: Plan) => {
        const isPremium = plan.slug === "business" || plan.slug === "enterprise";
        return isPremium || !!plan.features.api;
      },
    },
    {
      label: t("pricing.features.sla"),
      getIncluded: (plan: Plan) => {
        const isEnterprise = plan.slug === "enterprise";
        return isEnterprise || !!plan.features.sla;
      },
    },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border/50">
            <th className="text-left py-2.5 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Recursos
            </th>
            {plans.map((plan) => {
              const theme = planThemes[plan.slug] ?? planThemes.starter;
              return (
                <th key={plan.id} className={cn("text-center py-2.5 px-2 font-bold text-xs", theme.headerColor)}>
                  {plan.name}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {featureRows.map((row, idx) => (
            <tr key={idx} className={cn("border-b border-border/20", idx % 2 === 0 && "bg-muted/15")}>
              <td className="py-2.5 pr-4 text-sm text-foreground/80 font-medium">{row.label}</td>
              {plans.map((plan) => {
                const included = row.getIncluded ? row.getIncluded(plan) : true;
                const value = row.getValue ? row.getValue(plan) : null;
                const theme = planThemes[plan.slug] ?? planThemes.starter;

                return (
                  <td key={plan.id} className="text-center py-2.5 px-2">
                    {value !== null && value !== undefined ? (
                      <span className={cn(
                        "text-xs font-semibold",
                        included ? theme.headerColor : "text-muted-foreground/40"
                      )}>
                        {value}
                      </span>
                    ) : included ? (
                      <div className="flex justify-center">
                        <div className={cn("h-5 w-5 rounded-full flex items-center justify-center", theme.checkBg, theme.checkText)}>
                          <Check className="h-3 w-3" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground/30 flex items-center justify-center">
                          <X className="h-3 w-3" />
                        </div>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
