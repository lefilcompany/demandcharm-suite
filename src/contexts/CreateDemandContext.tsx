import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";

interface CreateDemandContextType {
  isOpen: boolean;
  initialDueDate: Date | null;
  /** Opens the method chooser (individual vs. from document). */
  openCreateDemand: (options?: { initialDueDate?: Date | null }) => void;
  closeCreateDemand: () => void;
  chooserOpen: boolean;
  importOpen: boolean;
  setChooserOpen: (o: boolean) => void;
  setImportOpen: (o: boolean) => void;
  chooseIndividual: () => void;
  chooseImport: () => void;
}

const noop = () => {};
const CreateDemandContext = createContext<CreateDemandContextType>({
  isOpen: false,
  initialDueDate: null,
  openCreateDemand: noop,
  closeCreateDemand: noop,
  chooserOpen: false,
  importOpen: false,
  setChooserOpen: noop,
  setImportOpen: noop,
  chooseIndividual: noop,
  chooseImport: noop,
});

export function useCreateDemandModal() {
  return useContext(CreateDemandContext);
}

export function CreateDemandProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [initialDueDate, setInitialDueDate] = useState<Date | null>(null);
  const guard = usePlanLimitGuard("demands");

  const openCreateDemand = useCallback((options?: { initialDueDate?: Date | null }) => {
    void guard(() => {
      setInitialDueDate(options?.initialDueDate ?? null);
      setChooserOpen(true);
    });
  }, [guard]);
  const chooseIndividual = useCallback(() => { setChooserOpen(false); setIsOpen(true); }, []);
  const chooseImport = useCallback(() => { setChooserOpen(false); setImportOpen(true); }, []);
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
    <CreateDemandContext.Provider value={{ isOpen, initialDueDate, openCreateDemand, closeCreateDemand, chooserOpen, importOpen, setChooserOpen, setImportOpen, chooseIndividual, chooseImport }}>
      {children}
    </CreateDemandContext.Provider>
  );
}
