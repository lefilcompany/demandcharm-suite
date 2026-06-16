import { useTranslation } from "react-i18next";
import { Check, Users, CreditCard, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const { t } = useTranslation();
  
  const steps = [
    { label: t("getStarted.step1"), icon: Users },
    { label: t("getStarted.step2"), icon: CreditCard },
    { label: t("getStarted.step3"), icon: CheckCircle2 },
  ];

  return (
    <div className="relative flex items-center justify-center mb-4">
      <div className="relative flex items-center gap-4 sm:gap-8">
        {steps.slice(0, totalSteps).map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const Icon = step.icon;

          return (
            <div key={index} className="flex items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2">
                {/* Step circle */}
                <div
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 text-sm font-semibold",
                    isCompleted && "bg-success text-success-foreground",
                    isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                    !isCompleted && !isActive && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                
                {/* Step label */}
                <span 
                  className={cn(
                    "text-xs font-medium hidden sm:inline",
                    isActive && "text-primary font-semibold",
                    isCompleted && "text-success",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              
              {/* Connector */}
              {index < totalSteps - 1 && (
                <div className={cn(
                  "h-px w-8 sm:w-12",
                  isCompleted ? "bg-success" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
