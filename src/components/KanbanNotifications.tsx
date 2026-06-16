import { ArrowRight, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanMoveNotification } from "@/hooks/useRealtimeDemands";
import { useTranslation } from "react-i18next";

interface KanbanNotificationsProps {
  notifications: KanbanMoveNotification[];
  onClear: (demandId: string) => void;
  onClearAll: () => void;
  onDemandClick?: (demandId: string) => void;
}

export function KanbanNotifications({ 
  notifications, 
  onClear, 
  onClearAll,
  onDemandClick 
}: KanbanNotificationsProps) {
  const { t } = useTranslation();
  
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.length > 1 && (
        <button
          onClick={onClearAll}
          className="self-end text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-background/80 backdrop-blur-sm border border-border/50"
        >
          {t("common.clearAll", "Limpar todas")}
        </button>
      )}
      
      {notifications.map((notification) => (
        <div
          key={notification.demandId}
          className={cn(
            "bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg p-3",
            "animate-in slide-in-from-right-5 fade-in duration-300",
            "cursor-pointer hover:bg-accent/50 transition-colors"
          )}
          onClick={() => onDemandClick?.(notification.demandId)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
              <span className="text-sm font-medium">
                {t("kanban.cardMoved", "Card movido")}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear(notification.demandId);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-sm text-foreground mt-1 font-medium truncate">
            {notification.demandTitle}
          </p>
          
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted">
              {notification.fromStatus}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
              {notification.toStatus}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
