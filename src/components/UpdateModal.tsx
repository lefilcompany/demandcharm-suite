import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import logoBlack from "@/assets/logo-soma-black.png";

const POLL_INTERVAL = 60 * 1000; // 60s
const UPDATE_TIMEOUT = 8 * 1000;

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function clearAppCaches() {
  if (!("caches" in window)) return;

  const cacheNames = await window.caches.keys();
  await Promise.allSettled(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
}

function reloadWithCacheBust() {
  const url = new URL(window.location.href);
  url.searchParams.set("soma-update", Date.now().toString());
  window.location.replace(url.toString());
}

export function UpdateModal() {
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // The preview/dev server does not publish /sw.js. Polling it caused a
      // rejected update every minute and could repeatedly reopen this modal.
      if (registration && import.meta.env.PROD) {
        updateIntervalRef.current = setInterval(() => {
          registration.update().catch((error) => {
            console.warn("Não foi possível verificar uma atualização do app:", error);
          });
        }, POLL_INTERVAL);
      }
    },
    onRegisterError(error) {
      console.warn("Não foi possível registrar a atualização do app:", error);
    },
  });

  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (needRefresh) setOpen(true);
  }, [needRefresh]);

  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, []);

  const handleUpdate = async () => {
    if (updating) return;

    setUpdating(true);
    try {
      // Some browsers never resolve updateServiceWorker while waiting for the
      // controllerchange event. The timeout guarantees that the UI cannot stay
      // stuck on "Atualizando..." forever.
      await Promise.race([
        updateServiceWorker(true),
        delay(UPDATE_TIMEOUT),
      ]);
    } catch (error) {
      console.error("Erro ao aplicar atualização:", error);
    } finally {
      // Keep the FCM worker registered, but remove stale app assets before a
      // cache-busted navigation. This also covers browsers where the PWA
      // library activated the worker without reloading the page.
      await clearAppCaches().catch((error) => {
        console.warn("Não foi possível limpar o cache do app:", error);
      });
      reloadWithCacheBust();
    }
  };

  const handleDismiss = () => {
    setOpen(false);
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-border/60 rounded-2xl shadow-2xl bg-gradient-to-br from-[#F28705]/15 via-background to-[#F28705]/5"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Decorative glow */}
        <div className="relative pt-8 pb-6 px-6">
          <div className="absolute inset-x-0 -top-16 h-32 bg-[#F28705]/20 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
          <DialogHeader className="items-center text-center gap-5 relative">
            <img src={logoBlack} alt="SoMA" className="h-16 w-auto mx-auto drop-shadow-sm" />
            <div className="space-y-2 flex flex-col items-center text-center w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F28705]/10 border border-[#F28705]/20">
                <Sparkles className="h-3.5 w-3.5 text-[#F28705]" />
                <span className="text-xs font-medium text-[#F28705]">Nova versão disponível</span>
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-center w-full">
                Novidades no SoMA!
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
                Uma nova versão está disponível com melhorias e correções.
                Atualize agora para ter a melhor experiência. Sua sessão será mantida.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 p-4 justify-center sm:justify-center border-t border-border/40">
          <Button
            onClick={handleUpdate}
            disabled={updating}
            className="group relative overflow-hidden sm:flex-1 h-11 rounded-xl bg-[#F28705] hover:bg-[#F8A04A] text-white hover:text-white shadow-lg shadow-[#F28705]/25 transition-all"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-out" aria-hidden="true" />
            <RefreshCw className={`h-4 w-4 mr-2 ${updating ? "animate-spin" : ""}`} />
            {updating ? "Atualizando..." : "Atualizar agora"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            disabled={updating}
            className="sm:flex-1 h-11 rounded-xl border border-transparent hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
          >
            Depois
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
