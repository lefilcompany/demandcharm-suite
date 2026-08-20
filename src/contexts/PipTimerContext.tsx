import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { PipTimerContent } from "@/components/PipTimerContent";

interface PipTimerContextValue {
  isSupported: boolean;
  pipDemandId: string | null;
  openPip: (demandId: string) => Promise<void>;
  closePip: () => void;
}

const PipTimerContext = createContext<PipTimerContextValue | undefined>(undefined);

export function usePipTimer() {
  const ctx = useContext(PipTimerContext);
  if (!ctx) {
    return {
      isSupported: false,
      pipDemandId: null,
      openPip: async () => {},
      closePip: () => {},
    } as PipTimerContextValue;
  }
  return ctx;
}

export const isPipSupported = () =>
  typeof window !== "undefined" && "documentPictureInPicture" in window;

function copyStyles(target: Window) {
  // Copy adopted stylesheets (Vite dev / CSS-in-JS)
  try {
    const sheets = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("");
          const style = target.document.createElement("style");
          style.textContent = rules;
          return style;
        } catch {
          const link = target.document.createElement("link");
          if (sheet.href) {
            link.rel = "stylesheet";
            link.href = sheet.href;
            return link;
          }
          return null;
        }
      })
      .filter(Boolean) as HTMLElement[];
    sheets.forEach((el) => target.document.head.appendChild(el));
  } catch {
    // ignore
  }

  // Mirror theme class (dark mode)
  target.document.documentElement.className = document.documentElement.className;
  target.document.body.style.margin = "0";
  target.document.body.style.overflow = "hidden";
}

export function PipTimerProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [pipDemandId, setPipDemandId] = useState<string | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const closePip = useCallback(() => {
    try {
      pipWindowRef.current?.close();
    } catch {
      // ignore
    }
    pipWindowRef.current = null;
    setContainer(null);
    setPipDemandId(null);
  }, []);

  const openPip = useCallback(
    async (demandId: string) => {
      if (!isPipSupported()) return;

      // Reuse existing window when already open
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        setPipDemandId(demandId);
        pipWindowRef.current.focus?.();
        return;
      }

      try {
        // @ts-expect-error - Document Picture-in-Picture API is not in TS lib yet
        const pipWindow: Window = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 120,
        });

        copyStyles(pipWindow);

        const root = pipWindow.document.createElement("div");
        root.style.height = "100%";
        pipWindow.document.body.appendChild(root);

        pipWindow.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
          setContainer(null);
          setPipDemandId(null);
        });

        pipWindowRef.current = pipWindow;
        setContainer(root);
        setPipDemandId(demandId);
      } catch (e) {
        console.error("Erro ao abrir janela flutuante:", e);
      }
    },
    []
  );

  const handleOpenDemand = useCallback(() => {
    const id = pipDemandId;
    closePip();
    try {
      window.focus();
    } catch {
      // ignore
    }
    if (id) navigate(`/demands/${id}`);
  }, [pipDemandId, closePip, navigate]);

  // Cleanup on unmount / tab close
  useEffect(() => {
    const onPageHide = () => {
      try {
        pipWindowRef.current?.close();
      } catch {
        // ignore
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
    };
  }, []);

  return (
    <PipTimerContext.Provider
      value={{ isSupported: isPipSupported(), pipDemandId, openPip, closePip }}
    >
      {children}
      {container && pipDemandId
        ? createPortal(
            <PipTimerContent
              demandId={pipDemandId}
              onOpenDemand={handleOpenDemand}
              onClose={closePip}
            />,
            container
          )
        : null}
    </PipTimerContext.Provider>
  );
}
