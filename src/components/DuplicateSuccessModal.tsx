import { CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

interface DuplicateSuccessModalProps {
  open: boolean;
  newDemandId: string | null;
  warning?: string | null;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateSuccessModal({
  open,
  newDemandId,
  warning,
  onOpenChange,
}: DuplicateSuccessModalProps) {
  const navigate = useNavigate();

  const handleGoToDemand = () => {
    if (!newDemandId) return;
    onOpenChange(false);
    navigate(`/demands/${newDemandId}`);
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <CheckCircle2 className="h-3.5 w-3.5 text-[#F28705]" />
                <span className="text-xs font-medium text-[#F28705]">Demanda duplicada</span>
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-center w-full">
                Demanda duplicada com sucesso!
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
                {warning
                  ? warning
                  : "Uma cópia exata da demanda foi criada no mesmo quadro, com responsáveis, subdemandas e checklist."}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 p-4 justify-center sm:justify-center border-t border-border/40">
          <Button
            onClick={handleGoToDemand}
            disabled={!newDemandId}
            className="group relative overflow-hidden sm:flex-1 h-11 rounded-xl bg-[#F28705] hover:bg-[#F8A04A] text-white hover:text-white shadow-lg shadow-[#F28705]/25 transition-all"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-out" aria-hidden="true" />
            <ArrowRight className="h-4 w-4 mr-2" />
            Ir para a cópia
          </Button>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="sm:flex-1 h-11 rounded-xl border border-transparent hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
