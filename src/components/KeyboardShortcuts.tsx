import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface Shortcut {
  keys: string[];
  description: string;
  action?: () => void;
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();

  const shortcuts: Shortcut[] = [
    { keys: ["Ctrl", "K"], description: "Busca global" },
    { keys: ["Ctrl", "Shift", "D"], description: "Nova demanda", action: () => { window.dispatchEvent(new CustomEvent("open-create-demand")); } },
    { keys: ["?"], description: "Mostrar atalhos" },
    { keys: ["G", "D"], description: "Ir para Dashboard", action: () => navigate("/") },
    { keys: ["G", "K"], description: "Ir para Kanban", action: () => navigate("/kanban") },
    { keys: ["G", "T"], description: "Ir para Equipes", action: () => navigate("/teams") },
    { keys: ["Esc"], description: "Fechar modais" },
  ];

  useEffect(() => {
    let gPressed = false;
    let gTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Show help with ?
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Ctrl+Shift+D for new demand
      if (e.key === "D" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-create-demand"));
        return;
      }

      // G + key navigation
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        gPressed = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        switch (e.key) {
          case "d":
            e.preventDefault();
            navigate("/");
            break;
          case "k":
            e.preventDefault();
            navigate("/kanban");
            break;
          case "t":
            e.preventDefault();
            navigate("/teams");
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, [navigate]);

  return (
    <>
      {children}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atalhos de Teclado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {shortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, j) => (
                    <kbd
                      key={j}
                      className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
