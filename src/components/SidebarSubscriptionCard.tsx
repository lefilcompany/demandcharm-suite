import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useTeamSubscription } from "@/hooks/useSubscription";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSidebar } from "@/components/ui/sidebar";
import { Crown, Sparkles, ArrowRight, Clock, Zap, Star, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PlansModal } from "@/components/PlansModal";
export function SidebarSubscriptionCard() {
  const [plansOpen, setPlansOpen] = useState(false);
  return (
    <>
      <SidebarSubscriptionCardInner onOpenPlans={() => setPlansOpen(true)} />
      <PlansModal open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}

function SidebarSubscriptionCardInner({ onOpenPlans }: { onOpenPlans: () => void }) {
  const {
    t
  } = useTranslation();
  const {
    state,
    isMobile,
    setOpenMobile
  } = useSidebar();
  const isCollapsed = state === "collapsed";
  const {
    currentTeam
  } = useSelectedTeam();
  const {
    isTrialActive,
    daysRemaining,
    totalTrialDays,
    isLoading: trialLoading
  } = useTrialStatus();
  const {
    data: subscription,
    isLoading: subLoading
  } = useTeamSubscription(currentTeam?.id);
  const showText = isMobile || !isCollapsed;
  const handleClick = () => {
    onOpenPlans();
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  if (trialLoading || subLoading) return null;

  // Has active subscription - show current plan
  if (subscription?.status === "active" && subscription.plan) {
    if (!showText) {
      return <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleClick} className="group relative w-8 h-8 mx-auto flex items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-300">
              <Crown className="h-4 w-4 text-primary-foreground" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/0 via-white/10 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">{subscription.plan.name}</p>
            <p className="text-xs text-muted-foreground">Plano ativo</p>
          </TooltipContent>
        </Tooltip>;
    }
    return <button onClick={handleClick} className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/95 to-primary/80 p-[1px] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <div className="relative rounded-[11px] bg-gradient-to-br from-primary via-primary/95 to-primary/85 p-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                <Crown className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 flex items-center justify-center shadow-lg">
                <Star className="h-2 w-2 text-emerald-900 fill-current" />
              </div>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-sm font-bold text-primary-foreground truncate block">
                {subscription.plan.name}
              </span>
              <span className="text-[11px] text-primary-foreground/70 font-medium">Plano ativo</span>
            </div>
            <ArrowRight className="h-4 w-4 text-primary-foreground/60 group-hover:text-primary-foreground group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </button>;
  }

  // Trial active - show trial status with urgency
  if (isTrialActive) {
    const getUrgencyLevel = () => {
      if (daysRemaining <= 3) return "critical";
      if (daysRemaining <= 7) return "warning";
      if (daysRemaining <= 14) return "attention";
      return "normal";
    };
    const urgency = getUrgencyLevel();
    const urgencyConfig = {
      critical: {
        gradient: "from-red-500 via-red-600 to-rose-600",
        bgGradient: "from-red-500/20 via-red-500/10 to-rose-500/5",
        border: "border-red-400/50",
        iconBg: "from-red-500 to-rose-600",
        text: "text-red-500",
        pulse: true,
        ctaText: "Assinar agora!"
      },
      warning: {
        gradient: "from-amber-500 via-orange-500 to-amber-600",
        bgGradient: "from-amber-500/20 via-amber-500/10 to-orange-500/5",
        border: "border-amber-400/50",
        iconBg: "from-amber-500 to-orange-600",
        text: "text-amber-500",
        pulse: false,
        ctaText: "Garanta seu plano"
      },
      attention: {
        gradient: "from-primary via-primary/90 to-accent",
        bgGradient: "from-primary/20 via-primary/10 to-accent/10",
        border: "border-primary/40",
        iconBg: "from-primary to-accent",
        text: "text-primary",
        pulse: false,
        ctaText: "Conhecer planos"
      },
      normal: {
        gradient: "from-emerald-500 via-teal-500 to-emerald-600",
        bgGradient: "from-emerald-500/15 via-teal-500/10 to-emerald-500/5",
        border: "border-emerald-400/40",
        iconBg: "from-emerald-500 to-teal-600",
        text: "text-emerald-500",
        pulse: false,
        ctaText: "Ver planos"
      }
    };
    const config = urgencyConfig[urgency];
    if (!showText) {
      return <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleClick} className={cn("group relative w-8 h-8 mx-auto flex items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-all duration-300 hover:scale-105", config.iconBg, urgency === "critical" ? "shadow-red-500/30 hover:shadow-red-500/50" : "shadow-primary/20")}>
              <ShoppingBag className="h-4 w-4 text-white" />
              {config.pulse && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-white animate-ping" />}
              {config.pulse && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-white" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">Período de Teste</p>
            <p className="text-xs text-muted-foreground">{daysRemaining === 0 ? "Último dia!" : daysRemaining === 1 ? "1 dia restante" : `${daysRemaining} dias restantes`}</p>
          </TooltipContent>
        </Tooltip>;
    }
    return <button onClick={handleClick} className={cn("group relative w-full overflow-hidden rounded-xl p-[1px] transition-all duration-300")}>
        {/* Border gradient */}
        <div className={cn("absolute inset-0 rounded-xl bg-gradient-to-br opacity-60", config.gradient)} />
        
        {/* Inner content */}
        <div className={cn("relative rounded-[11px] bg-gradient-to-br backdrop-blur-sm p-3", config.bgGradient, "bg-background/95")}>
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          <div className="relative">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className={cn("relative h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-md", config.iconBg)}>
                <ShoppingBag className="h-4.5 w-4.5 text-white" />
                {config.pulse && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 animate-bounce flex items-center justify-center">
                    <span className="text-[7px] font-bold text-white">!</span>
                  </span>}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">Período de Teste</span>
                  
                </div>
                <div className={cn("text-[11px] font-semibold", config.text)}>
                  {daysRemaining === 0 ? "🔥 Último dia!" : daysRemaining === 1 ? "⚡ 1 dia restante" : `${daysRemaining} dias restantes`}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-1.5 rounded-full bg-muted/50 overflow-hidden mb-2">
              <div className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-500", config.gradient)} style={{
              width: `${Math.max(5, (daysRemaining / totalTrialDays) * 100)}%`
            }} />
            </div>

            {/* CTA Button */}
            <div className={cn("flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-xs transition-all", "bg-gradient-to-r", config.gradient, "text-white shadow-md group-hover:shadow-lg group-hover:scale-[1.02]")}>
              <Zap className="h-3.5 w-3.5" />
              <span>{config.ctaText}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </button>;
  }

  // No subscription and no trial - show upgrade prompt
  if (!showText) {
    return <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handleClick} className="group relative w-8 h-8 mx-auto flex items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/90 to-accent shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-300 animate-pulse">
            <Crown className="h-4 w-4 text-primary-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">Escolha um plano</p>
          <p className="text-xs text-muted-foreground">Desbloqueie todo o potencial</p>
        </TooltipContent>
      </Tooltip>;
  }
  return <button onClick={handleClick} className="group relative w-full overflow-hidden rounded-xl p-[1px] transition-all duration-300">
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-accent to-primary opacity-70 animate-gradient-shift" />
      
      {/* Inner content */}
      <div className="relative rounded-[11px] bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 bg-background/95 backdrop-blur-sm p-3">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/30">
              <Crown className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-xs font-bold text-foreground block">Escolha um plano</span>
              <p className="text-[11px] text-muted-foreground">Desbloqueie todo o potencial</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-xs bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md group-hover:shadow-lg group-hover:scale-[1.02] transition-all">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ver planos</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </button>;
}