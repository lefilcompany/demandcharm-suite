import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Crown, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Subscription } from "@/hooks/useSubscription";
import { differenceInDays } from "date-fns";

interface SubscriptionBadgeProps {
  subscription: Subscription | null;
  planName?: string;
  className?: string;
  showIcon?: boolean;
}

export function SubscriptionBadge({
  subscription,
  planName,
  className,
  showIcon = true,
}: SubscriptionBadgeProps) {
  const { t } = useTranslation();

  const getStatusConfig = () => {
    if (!subscription) {
      return {
        label: planName || "Starter",
        variant: "secondary" as const,
        icon: null,
      };
    }

    const { status, trial_ends_at, cancel_at_period_end, current_period_end } = subscription;

    // Check if in trial
    if (status === "trialing" && trial_ends_at) {
      const daysLeft = differenceInDays(new Date(trial_ends_at), new Date());
      return {
        label: t("subscription.trial", { days: daysLeft }),
        variant: "default" as const,
        icon: Clock,
      };
    }

    // Check if canceling
    if (cancel_at_period_end && current_period_end) {
      const daysLeft = differenceInDays(new Date(current_period_end), new Date());
      return {
        label: t("subscription.cancelingIn", { days: daysLeft }),
        variant: "warning" as const,
        icon: AlertTriangle,
      };
    }

    switch (status) {
      case "active":
        return {
          label: planName || t("subscription.active"),
          variant: "success" as const,
          icon: Crown,
        };
      case "past_due":
        return {
          label: t("subscription.pastDue"),
          variant: "destructive" as const,
          icon: AlertTriangle,
        };
      case "canceled":
        return {
          label: t("subscription.canceled"),
          variant: "secondary" as const,
          icon: XCircle,
        };
      case "inactive":
        return {
          label: t("subscription.inactive"),
          variant: "secondary" as const,
          icon: null,
        };
      default:
        return {
          label: planName || "Starter",
          variant: "secondary" as const,
          icon: null,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const badgeVariants: Record<string, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  };

  return (
    <Badge
      className={cn(
        "gap-1",
        badgeVariants[config.variant],
        className
      )}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
