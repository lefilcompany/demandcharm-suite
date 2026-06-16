import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  spotlightPadding?: number;
}

interface OnboardingTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingTour({ steps, isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const calculatePosition = useCallback(() => {
    if (!step) return;

    const element = document.querySelector(step.target);
    if (!element) {
      // If element not found, try next step or close
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    setTargetRect(rect);

    const padding = step.spotlightPadding || 8;
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const margin = 16;

    let top = 0;
    let left = 0;

    const placement = step.placement || "bottom";

    switch (placement) {
      case "top":
        top = rect.top - tooltipHeight - margin;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + margin;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - margin;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + margin;
        break;
    }

    // Ensure tooltip stays within viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));

    setTooltipPosition({ top, left });

    // Scroll element into view if needed
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step, currentStep, steps.length]);

  // Reset to first step when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener("resize", calculatePosition);
      window.addEventListener("scroll", calculatePosition, true);
      
      return () => {
        window.removeEventListener("resize", calculatePosition);
        window.removeEventListener("scroll", calculatePosition, true);
      };
    }
  }, [isOpen, calculatePosition]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen || !step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity duration-300"
        onClick={handleSkip}
      />
      
      {/* Spotlight */}
      {targetRect && (
        <div
          className="absolute rounded-lg ring-4 ring-primary ring-offset-4 ring-offset-transparent transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - (step.spotlightPadding || 8),
            left: targetRect.left - (step.spotlightPadding || 8),
            width: targetRect.width + (step.spotlightPadding || 8) * 2,
            height: targetRect.height + (step.spotlightPadding || 8) * 2,
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.6)`,
          }}
        />
      )}

      {/* Tooltip */}
      <Card
        className={cn(
          "absolute w-80 shadow-2xl border-primary/20 animate-scale-in",
          "bg-background"
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{step.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="h-1 mt-2" />
        </CardHeader>

        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.content}
          </p>
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-0">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} de {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1"
            >
              {isLastStep ? (
                <>
                  Concluir
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>,
    document.body
  );
}
