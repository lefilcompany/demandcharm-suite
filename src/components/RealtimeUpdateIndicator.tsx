import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealtimeUpdateIndicatorProps {
  show: boolean;
  updateType?: "demand" | "interaction" | "assignee" | "subtask";
  onDismiss: () => void;
}

const updateMessages = {
  demand: "Demanda atualizada",
  interaction: "Novo comentário adicionado",
  assignee: "Responsáveis alterados",
  subtask: "Subtarefas atualizadas",
};

export function RealtimeUpdateIndicator({ 
  show, 
  updateType = "demand",
  onDismiss 
}: RealtimeUpdateIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
        show 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/25">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">
          {updateMessages[updateType]}
        </span>
        <button
          onClick={onDismiss}
          className="ml-1 p-0.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
          aria-label="Dispensar notificação"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
