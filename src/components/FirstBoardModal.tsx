import { useNavigate } from "react-router-dom";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useServices } from "@/hooks/useServices";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Package } from "lucide-react";
import { CreateBoardWizard } from "@/components/CreateBoardWizard";

export function FirstBoardModal() {
  const navigate = useNavigate();
  const { selectedTeamId, hasTeams, isLoading: teamsLoading } = useSelectedTeam();
  const { hasBoards, isLoading: boardsLoading } = useSelectedBoard();
  const { data: services, isLoading: servicesLoading } = useServices(selectedTeamId);

  const isLoading = teamsLoading || boardsLoading || servicesLoading;
  const shouldShowModal = !isLoading && hasTeams && !hasBoards;

  if (!shouldShowModal) return null;

  const hasNoServices = !services || services.length === 0;

  if (hasNoServices) {
    return (
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-[480px]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Cadastre um serviço primeiro</DialogTitle>
                <DialogDescription>
                  Sua equipe ainda não possui serviços cadastrados. É necessário
                  cadastrar ao menos um serviço antes de criar seu primeiro quadro.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                if (selectedTeamId) navigate(`/teams/${selectedTeamId}/services`);
              }}
            >
              Cadastrar serviços
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[860px] max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutGrid className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Crie seu primeiro quadro</DialogTitle>
              <DialogDescription>
                Configure em etapas: informações, fluxo Kanban, membros e serviços.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <CreateBoardWizard onComplete={() => { /* will hide automatically once board exists */ }} />
      </DialogContent>
    </Dialog>
  );
}
