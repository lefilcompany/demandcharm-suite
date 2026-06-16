import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const [dismissed, setDismissed] = useState(false);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="w-full bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-3 text-sm shrink-0 z-50">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span>Uma nova versão está disponível.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        Atualizar agora
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 p-0.5 rounded hover:bg-primary-foreground/20 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
