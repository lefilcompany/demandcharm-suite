import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { CreateBoardWizard } from "@/components/CreateBoardWizard";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";
import { useServices } from "@/hooks/useServices";
import { useSelectedTeam } from "@/contexts/TeamContext";

interface CreateBoardDialogProps {
  trigger?: React.ReactNode;
}

export function CreateBoardDialog({ trigger }: CreateBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const [noServicesOpen, setNoServicesOpen] = useState(false);
  const navigate = useNavigate();
  const guard = usePlanLimitGuard("boards");
  const { selectedTeamId } = useSelectedTeam();
  const { data: services, isLoading: servicesLoading, refetch } = useServices(selectedTeamId);

  const handleOpenChange = async (v: boolean) => {
    if (v) {
      // Ensure fresh data before deciding
      const result = servicesLoading ? await refetch() : { data: services };
      const list = result.data ?? services ?? [];
      if (!list || list.length === 0) {
        setNoServicesOpen(true);
        return;
      }
      await guard(() => setOpen(true));
    } else {
      setOpen(false);
    }
  };

  return (
    <>
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

      <Dialog open={noServicesOpen} onOpenChange={setNoServicesOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle>Cadastre um serviço primeiro</DialogTitle>
                <DialogDescription>
                  Sua equipe ainda não possui serviços cadastrados. É necessário
                  cadastrar ao menos um serviço antes de criar um quadro.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNoServicesOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setNoServicesOpen(false);
                if (selectedTeamId) navigate(`/teams/${selectedTeamId}/services`);
              }}
            >
              Cadastrar serviços
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
