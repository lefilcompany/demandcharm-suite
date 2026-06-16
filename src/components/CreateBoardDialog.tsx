import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateBoardWizard } from "@/components/CreateBoardWizard";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";

interface CreateBoardDialogProps {
  trigger?: React.ReactNode;
}

export function CreateBoardDialog({ trigger }: CreateBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const guard = usePlanLimitGuard("boards");

  const handleOpenChange = async (v: boolean) => {
    if (v) {
      await guard(() => setOpen(true));
    } else {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Quadro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[860px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Novo Quadro</DialogTitle>
          <DialogDescription>
            Configure o quadro em etapas: informações, fluxo do Kanban, membros e serviços.
          </DialogDescription>
        </DialogHeader>
        <CreateBoardWizard
          onComplete={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
