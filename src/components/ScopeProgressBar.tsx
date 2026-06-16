import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ScopeProgressBarProps {
  used: number;
  limit: number;
  className?: string;
}

export function ScopeProgressBar({ used, limit, className }: ScopeProgressBarProps) {
  const { t } = useTranslation();

  if (limit === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("scope.demandsThisMonth")}</span>
          <span className="font-medium">{used} {t("demands.title").toLowerCase()}</span>
        </div>
        <div className="text-xs text-muted-foreground">{t("scope.noLimitDefined")}</div>
      </div>
    );
  }

  const percentage = Math.min((used / limit) * 100, 100);
  const remaining = Math.max(limit - used, 0);
  
  const getProgressColor = () => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-warning";
    if (percentage >= 50) return "bg-amber-400";
    return "bg-success";
  };

  const getStatusText = () => {
    if (percentage >= 100) return t("scope.limitReached");
    if (percentage >= 80) return t("scope.nearLimit");
    return t("scope.remaining", { count: remaining });
  };

  const getStatusColor = () => {
    if (percentage >= 100) return "text-destructive font-medium";
    if (percentage >= 80) return "text-warning";
    if (percentage >= 50) return "text-amber-500";
    return "text-success";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("scope.monthlyUsage")}</span>
        <span className="font-medium">
          {used}/{limit} {t("demands.title").toLowerCase()} ({Math.round(percentage)}%)
        </span>
      </div>
      <Progress 
        value={percentage} 
        className="h-3 bg-muted"
        indicatorClassName={getProgressColor()}
      />
      <div className={cn("text-xs", getStatusColor())}>
        {getStatusText()}
      </div>
    </div>
  );
}
