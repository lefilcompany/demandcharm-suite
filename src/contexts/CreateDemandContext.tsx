import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";

interface CreateDemandContextType {
  isOpen: boolean;
  initialDueDate: Date | null;
  openCreateDemand: (options?: { initialDueDate?: Date | null }) => void;
  closeCreateDemand: () => void;
}

const CreateDemandContext = createContext<CreateDemandContextType>({
  isOpen: false,
  initialDueDate: null,
  openCreateDemand: () => {},
  closeCreateDemand: () => {},
});

export function useCreateDemandModal() {
  return useContext(CreateDemandContext);
}

export function CreateDemandProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialDueDate, setInitialDueDate] = useState<Date | null>(null);
  const guard = usePlanLimitGuard("demands");

  const openCreateDemand = useCallback((options?: { initialDueDate?: Date | null }) => {
    void guard(() => {
      setInitialDueDate(options?.initialDueDate ?? null);
      setIsOpen(true);
    });
  }, [guard]);
  const closeCreateDemand = useCallback(() => {
    setIsOpen(false);
    setInitialDueDate(null);
  }, []);

  // Listen for custom events from CommandMenu/KeyboardShortcuts
  useEffect(() => {
    const handler = () => openCreateDemand();
    window.addEventListener("open-create-demand", handler);
    return () => window.removeEventListener("open-create-demand", handler);
  }, [openCreateDemand]);

  return (
    <CreateDemandContext.Provider value={{ isOpen, initialDueDate, openCreateDemand, closeCreateDemand }}>
      {children}
    </CreateDemandContext.Provider>
  );
}
