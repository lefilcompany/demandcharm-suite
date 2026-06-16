import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plan } from "@/hooks/usePlans";
import { Check, Pencil, Sparkles } from "lucide-react";

interface SelectedPlanCardProps {
  plan: Plan;
  onEdit: () => void;
}

export function SelectedPlanCard({ plan, onEdit }: SelectedPlanCardProps) {
  const { t } = useTranslation();
  
  const isPopular = plan.slug === "profissional";
  const features = Array.isArray(plan.features) ? plan.features.slice(0, 3) : [];

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-[1px]">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
      
      <div className="relative rounded-[11px] bg-card/95 backdrop-blur-sm p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground">{plan.name}</h3>
              {isPopular && (
                <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 text-[10px] px-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              )}
            </div>
            
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-primary">
                R$ {(plan.price_cents / 100).toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">/{t("pricing.month")}</span>
            </div>
            
            {features.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-success" />
                    <span className="truncate">{String(feature)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onEdit}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-4 w-4 mr-1" />
            {t("common.edit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
