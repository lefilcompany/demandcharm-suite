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
const ACTIVATION_TIMEOUT = 15 * 1000;
const SESSION_FLAG = "soma-update-prompted";

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function clearAppCaches() {
  if (!("caches" in window)) return;

  const cacheNames = await window.caches.keys();
  // Preserve FCM/messaging caches; only drop app-shell buckets.
  const appCaches = cacheNames.filter((name) => !/firebase|fcm|onesignal/i.test(name));
  await Promise.allSettled(appCaches.map((cacheName) => window.caches.delete(cacheName)));
}

function reload() {
  const url = new URL(window.location.href);
  // Remove any legacy cache-bust marker so it does not accumulate.
  url.searchParams.delete("soma-update");
  window.location.replace(url.toString());
}

/** Resolves when the new service worker takes control (or after a timeout). */
function waitForControllerChange(timeout: number) {
  if (!("serviceWorker" in navigator)) return delay(0);
  return Promise.race([
    new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    }),
    delay(timeout),
  ]);
}

export function UpdateModal() {
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
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
    if (!needRefresh) return;
    // Only prompt once per browsing session, even if the SW keeps reporting a
    // waiting worker (e.g. activation was blocked by another open tab).
    if (sessionStorage.getItem(SESSION_FLAG) === "1") {
      setNeedRefresh(false);
      return;
    }
    sessionStorage.setItem(SESSION_FLAG, "1");
    setOpen(true);
  }, [needRefresh, setNeedRefresh]);

  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, []);

  const handleUpdate = async () => {
    if (updating) return;

    setUpdating(true);
    try {
      const registration = registrationRef.current;
      const waiting = registration?.waiting;

      if (waiting) {
        // Ask the waiting worker to activate and wait until it controls the page.
        const controllerChanged = waitForControllerChange(ACTIVATION_TIMEOUT);
        waiting.postMessage({ type: "SKIP_WAITING" });
        await controllerChanged;
      } else {
        await Promise.race([updateServiceWorker(true), delay(ACTIVATION_TIMEOUT)]);
      }
    } catch (error) {
      console.error("Erro ao aplicar atualização:", error);
    } finally {
      await clearAppCaches().catch((error) => {
        console.warn("Não foi possível limpar o cache do app:", error);
      });
      reload();
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
