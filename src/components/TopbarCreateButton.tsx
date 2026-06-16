import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateRequestQuickDialog } from "@/components/CreateRequestQuickDialog";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";

export function TopbarCreateButton() {
  const { openCreateDemand } = useCreateDemandModal();
  const { selectedTeamId } = useSelectedTeam();
  const { selectedBoardId } = useSelectedBoardSafe();
  const { data: bRole } = useBoardRole(selectedBoardId);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const guardDemands = usePlanLimitGuard("demands");

  if (!selectedTeamId) return null;

  const isRequester = bRole === "requester";
  const label = isRequester ? "Nova Solicitação" : "Nova Demanda";
  const tooltip = isRequester ? "Criar nova solicitação" : "Criar nova demanda (Ctrl+Shift+D)";

  const handleClick = isRequester
    ? async () => { const ok = await guardDemands(); if (ok) setRequestDialogOpen(true); }
    : () => openCreateDemand();


  return (
    <>
      {/* Desktop: labeled button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="group relative overflow-hidden h-7 gap-1.5 px-2.5 text-xs font-medium hidden sm:inline-flex !bg-[#F28705] !text-white !border-transparent hover:!bg-[#F28705]/90 hover:!text-white hover:!border-transparent transition-colors"
            onClick={handleClick}
            aria-label={label}
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
            <Plus className="h-3.5 w-3.5 relative" />
            <span className="relative">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>

      {/* Mobile: icon only */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="h-7 w-7 shrink-0 sm:hidden"
            onClick={handleClick}
            aria-label={label}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>

      {/* Request creation dialog for requesters */}
      {isRequester && (
        <CreateRequestQuickDialog
          open={requestDialogOpen}
          onOpenChange={setRequestDialogOpen}
          selectedDate={null}
        />
      )}
    </>
  );
}
