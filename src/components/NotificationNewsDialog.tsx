import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notificationNewsBus } from "@/lib/notificationNewsBus";
import type { AppNotification } from "@/hooks/useNotifications";

export function NotificationNewsDialog() {
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const navigate = useNavigate();

  useEffect(() => notificationNewsBus.subscribe(setNotification), []);

  const close = () => setNotification(null);
  const openFeature = () => {
    const link = notification?.link;
    if (!link) return;
    close();
    navigate(link);
  };

  return (
    <Dialog open={notification !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="flex max-h-[85dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-5 pt-6 text-left sm:px-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            <span>Novidades do SoMA+</span>
          </div>
          <DialogTitle className="break-words pr-6 text-2xl leading-snug tracking-normal">
            {notification?.title}
          </DialogTitle>
          <DialogDescription>
            {notification && new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(notification.created_at))}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8">
          <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert prose-headings:text-foreground prose-p:whitespace-pre-wrap prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground">
            <ReactMarkdown>{notification?.message ?? ""}</ReactMarkdown>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:px-8">
          <Button variant="outline" onClick={close}>Fechar</Button>
          {notification?.link && (
            <Button onClick={openFeature}>Acessar funcionalidade <ArrowRight className="ml-2 h-4 w-4" /></Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}