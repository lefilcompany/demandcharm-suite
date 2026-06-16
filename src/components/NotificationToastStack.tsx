import { useEffect, useState } from "react";
import { Bell, X, ExternalLink, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { notificationToastBus } from "@/lib/notificationToastBus";
import type { AppNotification } from "@/hooks/useNotifications";

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE = 4;

function extractBoardName(title: string): { boardName: string | null; cleanTitle: string } {
  const match = title.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) return { boardName: match[1], cleanTitle: match[2] };
  return { boardName: null, cleanTitle: title };
}

const typeColor = (type: string) => {
  switch (type) {
    case "success": return "bg-success";
    case "warning": return "bg-warning";
    case "error": return "bg-destructive";
    default: return "bg-primary";
  }
};

export function NotificationToastStack() {
  const [items, items_set] = useState<AppNotification[]>([]);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = notificationToastBus.subscribe((n) => {
      items_set((prev) => {
        if (prev.some((p) => p.id === n.id)) return prev;
        return [n, ...prev];
      });
      // schedule auto-dismiss
      window.setTimeout(() => {
        items_set((prev) => prev.filter((p) => p.id !== n.id));
      }, AUTO_DISMISS_MS);
    });
    return () => { unsub(); };
  }, []);

  if (items.length === 0) return null;

  const dismiss = (id: string) => items_set((prev) => prev.filter((p) => p.id !== id));
  const dismissAll = () => items_set([]);
  const handleClick = (n: AppNotification) => {
    dismiss(n.id);
    if (n.link) navigate(n.link);
  };

  const visible = expanded ? items : items.slice(0, MAX_VISIBLE);
  const hiddenCount = items.length - visible.length;
  const isStacked = !expanded && items.length > 1;

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-[100] w-[min(calc(100vw-2rem),360px)] max-w-[360px] pointer-events-none">
      {items.length > 1 && (
        <div className="flex justify-end mb-2 pointer-events-auto gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] font-medium text-foreground/80 bg-background/90 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 shadow-sm hover:bg-muted transition-colors flex items-center gap-1"
          >
            <Bell className="h-3 w-3" />
            {expanded ? "Recolher" : `${items.length} novas`}
          </button>
          <button
            onClick={dismissAll}
            className="text-[11px] font-medium text-muted-foreground bg-background/90 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 shadow-sm hover:bg-muted transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      <div className={cn("relative", isStacked && "h-[88px]")}>
        {visible.map((n, idx) => {
          const { boardName, cleanTitle } = extractBoardName(n.title);
          const stackStyle = isStacked
            ? {
                position: "absolute" as const,
                top: idx * 6,
                left: idx * 4,
                right: -idx * 4,
                zIndex: visible.length - idx,
                transform: `scale(${1 - idx * 0.04})`,
                opacity: idx === 0 ? 1 : 0.85 - idx * 0.1,
              }
            : undefined;

          return (
            <div
              key={n.id}
              style={stackStyle}
              className={cn(
                "pointer-events-auto bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-xl p-3 cursor-pointer hover:bg-muted/60 transition-all",
                "animate-slide-in-right",
                !isStacked && idx > 0 && "mt-2"
              )}
              onClick={() => handleClick(n)}
            >
              <div className="flex items-start gap-2">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", typeColor(n.type))} />
                <div className="flex-1 min-w-0">
                  {boardName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground border-muted-foreground/30 mb-1">
                      <LayoutGrid className="h-2.5 w-2.5 mr-1" />
                      {boardName}
                    </Badge>
                  )}
                  <p className="text-sm font-medium leading-tight truncate">{cleanTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  {n.link && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                      <ExternalLink className="h-3 w-3" />
                      <span>Abrir</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5"
                  aria-label="Dispensar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {!expanded && hiddenCount > 0 && (
          <div className="absolute -bottom-5 right-2 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 border border-border pointer-events-none">
            +{hiddenCount}
          </div>
        )}
      </div>
    </div>
  );
}
