import { Plus } from "lucide-react";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function SideCreateDemandButton() {
  const { openCreateDemand } = useCreateDemandModal();
  const { selectedTeamId } = useSelectedTeam();
  const isMobile = useIsMobile();

  if (isMobile || !selectedTeamId) return null;

  return (
    <button
      onClick={() => openCreateDemand()}
      className="fixed right-0 bottom-16 z-40 group flex items-center
        bg-primary text-primary-foreground shadow-lg
        rounded-l-lg overflow-hidden cursor-pointer
        transition-all duration-300 ease-in-out
        w-6 hover:w-auto
        py-2.5 pl-1.5 pr-0 hover:pl-3 hover:pr-4"
      aria-label="Criar nova demanda"
    >
      <Plus className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap text-sm font-medium max-w-0 group-hover:max-w-40 overflow-hidden transition-all duration-300 group-hover:ml-2">
        Nova Demanda
      </span>
    </button>
  );
}
