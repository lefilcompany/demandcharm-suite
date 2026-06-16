import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Calendar, 
  FileText, 
  TrendingUp,
  ChevronDown,
  Clock,
  Target,
  Infinity as InfinityIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, endOfMonth } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { useState } from "react";

interface ScopeOverviewCardProps {
  used: number;
  limit: number;
  contractStart?: string | null;
  contractEnd?: string | null;
  scopeDescription?: string | null;
  active?: boolean;
  className?: string;
}

export function ScopeOverviewCard({
  used,
  limit,
  contractStart,
  contractEnd,
  scopeDescription,
  active = true,
  className,
}: ScopeOverviewCardProps) {
  const { t, i18n } = useTranslation();
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

  const getLocale = () => {
    switch (i18n.language) {
      case "pt-BR": return ptBR;
      case "es": return es;
      default: return enUS;
    }
  };

  const isUnlimited = limit === 0;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const remaining = isUnlimited ? 0 : Math.max(limit - used, 0);
  
  const now = new Date();
  const monthEnd = endOfMonth(now);
  const daysLeftInMonth = differenceInDays(monthEnd, now);
  
  const contractEndDate = contractEnd ? new Date(contractEnd) : null;
  const daysUntilContractEnd = contractEndDate ? differenceInDays(contractEndDate, now) : null;
  const isContractExpiring = daysUntilContractEnd !== null && daysUntilContractEnd <= 7 && daysUntilContractEnd > 0;
  const isContractExpired = daysUntilContractEnd !== null && daysUntilContractEnd < 0;

  const getStatus = () => {
    if (!active || isContractExpired) {
      return { 
        key: "inactive", 
        label: t("scope.contractExpired"), 
        color: "bg-destructive text-destructive-foreground",
        icon: XCircle,
        iconColor: "text-destructive"
      };
    }
    if (!isUnlimited && percentage >= 100) {
      return { 
        key: "limitReached", 
        label: t("scope.limitReached"), 
        color: "bg-destructive text-destructive-foreground",
        icon: XCircle,
        iconColor: "text-destructive"
      };
    }
    if (isContractExpiring) {
      return { 
        key: "expiring", 
        label: t("scope.contractExpiring"), 
        color: "bg-warning text-warning-foreground",
        icon: AlertTriangle,
        iconColor: "text-warning"
      };
    }
    if (!isUnlimited && percentage >= 80) {
      return { 
        key: "nearLimit", 
        label: t("scope.nearLimit"), 
        color: "bg-warning text-warning-foreground",
        icon: AlertTriangle,
        iconColor: "text-warning"
      };
    }
    return { 
      key: "active", 
      label: t("scope.active"), 
      color: "bg-success text-success-foreground",
      icon: CheckCircle2,
      iconColor: "text-success"
    };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  const getProgressColor = () => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-warning";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-success";
  };

  const canCreate = active && !isContractExpired && (isUnlimited || remaining > 0);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t("scope.planStatus")}
          </CardTitle>
          <Badge className={cn("gap-1", status.color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Demandas Usadas */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t("scope.demandsUsed")}
            </div>
            <div className="text-2xl font-bold">
              {used}
              <span className="text-base font-normal text-muted-foreground">
                /{isUnlimited ? <InfinityIcon className="inline h-4 w-4 ml-1" /> : limit}
              </span>
            </div>
            {!isUnlimited && (
              <Progress 
                value={percentage} 
                className="h-2"
                indicatorClassName={getProgressColor()}
              />
            )}
            <div className="text-xs text-muted-foreground">
              {isUnlimited 
                ? t("scope.unlimited")
                : t("scope.remaining", { count: remaining })
              }
            </div>
          </div>

          {/* Vigência do Contrato */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {t("scope.contractPeriod")}
            </div>
            {contractStart && contractEnd ? (
              <>
                <div className="text-sm font-medium">
                  {format(new Date(contractStart), "dd/MM", { locale: getLocale() })}
                  {" → "}
                  {format(new Date(contractEnd), "dd/MM/yy", { locale: getLocale() })}
                </div>
                <div className={cn(
                  "text-xs",
                  isContractExpired ? "text-destructive font-medium" :
                  isContractExpiring ? "text-warning font-medium" :
                  "text-muted-foreground"
                )}>
                  {isContractExpired 
                    ? t("scope.contractExpired")
                    : daysUntilContractEnd !== null 
                      ? t("scope.daysRemaining", { count: daysUntilContractEnd })
                      : ""
                  }
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t("scope.noContractDefined")}
              </div>
            )}
          </div>

          {/* Disponibilidade */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {canCreate ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {t("scope.availability")}
            </div>
            <div className={cn(
              "text-sm font-medium",
              canCreate ? "text-success" : "text-destructive"
            )}>
              {canCreate 
                ? t("scope.canCreateDemands")
                : t("scope.cannotCreateDemands")
              }
            </div>
          </div>

          {/* Dias restantes no mês */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {t("scope.monthProgress")}
            </div>
            <div className="text-2xl font-bold">
              {daysLeftInMonth}
              <span className="text-base font-normal text-muted-foreground ml-1">
                {t("scope.daysLeft")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {t("scope.untilReset")}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar with Markers */}
        {!isUnlimited && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("scope.monthlyUsage")}</span>
              <span className="font-medium">{Math.round(percentage)}%</span>
            </div>
            <div className="relative">
              <Progress 
                value={percentage} 
                className="h-4"
                indicatorClassName={cn(
                  getProgressColor(),
                  "transition-all duration-500"
                )}
              />
              {/* Markers */}
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <div className="absolute left-1/2 h-full w-px bg-border" />
                <div className="absolute left-[80%] h-full w-px bg-border" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>50%</span>
              <span>80%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Contextual Alerts */}
        {isContractExpired && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {t("scope.contractExpiredAlert")}
            </AlertDescription>
          </Alert>
        )}
        
        {isContractExpiring && !isContractExpired && (
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              {t("scope.contractExpiresIn", { days: daysUntilContractEnd })}
            </AlertDescription>
          </Alert>
        )}

        {!isUnlimited && percentage >= 80 && percentage < 100 && !isContractExpiring && (
          <Alert className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              {t("scope.nearLimitAlert", { remaining })}
            </AlertDescription>
          </Alert>
        )}

        {!isUnlimited && percentage >= 100 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {t("scope.limitReachedAlert")}
            </AlertDescription>
          </Alert>
        )}

        {/* Scope Description */}
        {scopeDescription && (
          <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
              <span className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("scope.yourPlan")}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isDescriptionOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="p-3 rounded-lg border bg-card text-sm text-muted-foreground whitespace-pre-wrap">
                {scopeDescription}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
