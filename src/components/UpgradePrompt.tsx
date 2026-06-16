import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TrendingUp, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  resourceType: "demands" | "boards" | "members" | "notes";
  currentUsage: number;
  limit: number;
  planName?: string;
}

export function UpgradePrompt({
  open,
  onOpenChange,
  resourceType,
  currentUsage,
  limit,
  planName,
}: UpgradePromptProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const resourceLabels: Record<string, string> = {
    demands: t("pricing.resources.demands"),
    boards: t("pricing.resources.boards"),
    members: t("pricing.resources.members"),
    notes: t("pricing.resources.notes"),
  };

  const handleUpgrade = () => {
    onOpenChange?.(false);
    navigate("/pricing");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            {t("subscription.limitReached")}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              {t("subscription.limitReachedDescription", {
                resource: resourceLabels[resourceType],
                limit,
                plan: planName || "Starter",
              })}
            </p>
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span>{t("subscription.currentUsage")}</span>
                <span className="font-semibold text-destructive">
                  {currentUsage} / {limit}
                </span>
              </div>
            </div>
            <p className="text-sm">
              {t("subscription.upgradeToUnlock")}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {t("pricing.upgrade")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface UpgradeBannerProps {
  resourceType: "demands" | "boards" | "members" | "notes";
  currentUsage: number;
  limit: number;
  className?: string;
}

export function UpgradeBanner({
  resourceType,
  currentUsage,
  limit,
  className,
}: UpgradeBannerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const percentage = (currentUsage / limit) * 100;
  const isNearLimit = percentage >= 80 && percentage < 100;
  const isAtLimit = percentage >= 100;

  if (!isNearLimit && !isAtLimit) return null;

  const resourceLabels: Record<string, string> = {
    demands: t("pricing.resources.demands"),
    boards: t("pricing.resources.boards"),
    members: t("pricing.resources.members"),
    notes: t("pricing.resources.notes"),
  };

  return (
    <Alert
      className={cn(
        className,
        isAtLimit
          ? "border-destructive bg-destructive/10"
          : "border-warning bg-warning/10"
      )}
    >
      {isAtLimit ? (
        <XCircle className="h-4 w-4 text-destructive" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-warning" />
      )}
      <AlertTitle className={isAtLimit ? "text-destructive" : "text-warning"}>
        {isAtLimit ? t("subscription.limitReached") : t("subscription.nearLimit")}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {isAtLimit
            ? t("subscription.limitReachedBanner", { resource: resourceLabels[resourceType] })
            : t("subscription.nearLimitBanner", {
                resource: resourceLabels[resourceType],
                remaining: limit - currentUsage,
              })}
        </span>
        <Button
          size="sm"
          variant={isAtLimit ? "destructive" : "default"}
          onClick={() => navigate("/pricing")}
          className="ml-4"
        >
          {t("pricing.upgrade")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
