import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlanCard } from "@/components/PlanCard";
import { usePlans, Plan } from "@/hooks/usePlans";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamSubscription } from "@/hooks/useSubscription";
import { useCreateCheckout } from "@/hooks/useCheckout";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { toast } from "sonner";
import { Clock, Sparkles } from "lucide-react";

interface PlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlansModal({ open, onOpenChange }: PlansModalProps) {
  const { data: plans, isLoading } = usePlans();
  const { currentTeam, selectedTeamId } = useSelectedTeam();
  const { data: subscription } = useTeamSubscription(currentTeam?.id);
  const { isTrialActive, daysRemaining } = useTrialStatus();
  const createCheckout = useCreateCheckout();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const currentPlanId = subscription?.plan?.id;
  const isTrial = subscription?.status === "trialing" && isTrialActive;

  const handleSelectPlan = async (plan: Plan) => {
    if (!selectedTeamId) {
      toast.error("Equipe não encontrada");
      return;
    }
    setLoadingSlug(plan.slug);
    try {
      const url = await createCheckout.mutateAsync({ planSlug: plan.slug, teamId: selectedTeamId });
      window.location.href = url;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao iniciar checkout";
      toast.error(msg);
      setLoadingSlug(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Escolha seu plano
          </DialogTitle>
          <DialogDescription>
            {isTrial
              ? "Selecione um plano para continuar usando a plataforma após o período de teste."
              : "Desbloqueie todo o potencial da plataforma escolhendo o plano ideal para sua equipe."}
          </DialogDescription>
        </DialogHeader>

        {isTrial && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full w-fit">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {daysRemaining === 0
                ? "Último dia de teste grátis"
                : daysRemaining === 1
                ? "1 dia restante no teste grátis"
                : `${daysRemaining} dias restantes no teste grátis`}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
            {plans?.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={plan.id === currentPlanId && !isTrial}
                onSelect={handleSelectPlan}
                isLoading={loadingSlug === plan.slug}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
