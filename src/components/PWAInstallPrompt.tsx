import { useState, useEffect } from "react";
import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useTranslation } from "react-i18next";

export function PWAInstallPrompt() {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, promptInstall, isIOS } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Show prompt after 30 seconds if installable and not installed
    if (isInstallable && !isInstalled) {
      const timer = setTimeout(() => {
        const dismissed = localStorage.getItem("pwa-prompt-dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }, 30000);
      
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result?.outcome === "ios-instructions") {
      setShowIOSInstructions(true);
      setShowPrompt(false);
    } else if (result?.outcome === "accepted") {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  const handleDismissIOS = () => {
    setShowIOSInstructions(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showPrompt && !showIOSInstructions) return null;

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-card border border-border rounded-t-2xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Instalar SoMA</h3>
            <Button variant="ghost" size="icon" onClick={handleDismissIOS}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Para instalar o SoMA no seu iPhone/iPad:
          </p>
          
          <ol className="space-y-3">
            <li className="flex items-center gap-3 text-sm">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Share className="h-4 w-4 text-primary" />
              </div>
              <span>Toque no botão <strong>Compartilhar</strong> na barra do Safari</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <span>Selecione <strong>"Adicionar à Tela de Início"</strong></span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <span>Toque em <strong>"Adicionar"</strong> para confirmar</span>
            </li>
          </ol>
          
          <Button variant="outline" className="w-full" onClick={handleDismissIOS}>
            Entendi
          </Button>
        </div>
      </div>
    );
  }

  // Standard Install Prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom duration-300">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Download className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground">Instalar SoMA</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Instale o app para acesso rápido e notificações
            </p>
          </div>
          
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2 mt-3">
          <Button variant="outline" className="flex-1" onClick={handleDismiss}>
            Agora não
          </Button>
          <Button className="flex-1" onClick={handleInstall}>
            {isIOS ? "Ver instruções" : "Instalar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
