import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { PlansModal } from "@/components/PlansModal";

interface PlansModalContextValue {
  openPlans: () => void;
  closePlans: () => void;
}

const PlansModalContext = createContext<PlansModalContextValue | undefined>(undefined);

export function PlansModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPlans = useCallback(() => setOpen(true), []);
  const closePlans = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openPlans, closePlans }), [openPlans, closePlans]);

  return (
    <PlansModalContext.Provider value={value}>
      {children}
      <PlansModal open={open} onOpenChange={setOpen} />
    </PlansModalContext.Provider>
  );
}

export function usePlansModal() {
  const ctx = useContext(PlansModalContext);
  if (!ctx) {
    // Fallback no-op so hooks can call this even before provider mounts (e.g. during tests).
    return { openPlans: () => {}, closePlans: () => {} } as PlansModalContextValue;
  }
  return ctx;
}
