import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertTriangle, Infinity as InfinityIcon } from "lucide-react";

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  className?: string;
  showPercentage?: boolean;
}

export function UsageMeter({
  label,
  used,
  limit,
  className,
  showPercentage = true,
}: UsageMeterProps) {
  const { t } = useTranslation();
  
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const remaining = isUnlimited ? null : Math.max(limit - used, 0);

  const getProgressColor = () => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-warning";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-success";
  };

  const getStatusColor = () => {
    if (percentage >= 100) return "text-destructive";
    if (percentage >= 80) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn("flex items-center gap-1", getStatusColor())}>
          {percentage >= 80 && !isUnlimited && (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {isUnlimited ? (
            <span className="flex items-center gap-1">
              {used} / <InfinityIcon className="h-3.5 w-3.5" />
            </span>
          ) : (
            <>
              {used} / {limit}
              {showPercentage && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round(percentage)}%)
                </span>
              )}
            </>
          )}
        </span>
      </div>
      
      {!isUnlimited && (
        <Progress
          value={percentage}
          className="h-2"
          indicatorClassName={getProgressColor()}
        />
      )}
      
      {!isUnlimited && remaining !== null && (
        <p className="text-xs text-muted-foreground">
          {remaining === 0
            ? t("subscription.limitReached")
            : t("scope.remaining", { count: remaining })}
        </p>
      )}
    </div>
  );
}
