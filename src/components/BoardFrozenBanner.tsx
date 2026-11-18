import { Lock } from "lucide-react";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useBoardFrozen } from "@/hooks/useBoardFrozen";

export function BoardFrozenBanner() {
  const { selectedBoardId } = useSelectedBoardSafe();
  const frozen = useBoardFrozen(selectedBoardId);
  if (!frozen) return null;
  return (
    <div role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p><span className="font-semibold">Quadro em modo leitura.</span> O projeto deste quadro está inativo: não é possível criar demandas, abrir solicitações, mudar etapas nem contar tempo. Peça ao dono da equipe ou ao gestor de projetos para reativar o projeto.</p>
    </div>
  );
}
