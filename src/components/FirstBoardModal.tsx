import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoard } from "@/contexts/BoardContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LayoutGrid } from "lucide-react";
import { CreateBoardWizard } from "@/components/CreateBoardWizard";

export function FirstBoardModal() {
  const { hasTeams, isLoading: teamsLoading } = useSelectedTeam();
  const { hasBoards, isLoading: boardsLoading } = useSelectedBoard();

  const isLoading = teamsLoading || boardsLoading;
  const shouldShowModal = !isLoading && hasTeams && !hasBoards;

  if (!shouldShowModal) return null;

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
