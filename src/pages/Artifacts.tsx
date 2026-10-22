import { SEOHead } from "@/components/SEOHead";
import { ArtifactsBrowser } from "@/components/artifacts/ArtifactsBrowser";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useBoard } from "@/hooks/useBoards";
import { useSprints } from "@/hooks/useSprints";
import { useDemands } from "@/hooks/useDemands";

export default function Artifacts() {
  const { selectedBoardId } = useSelectedBoard();
  const { data: role } = useBoardRole(selectedBoardId);
  const { data: board } = useBoard(selectedBoardId);
  const { data: sprints = [] } = useSprints(selectedBoardId);
  const { data: demands = [] } = useDemands(selectedBoardId || undefined);

  if (!selectedBoardId) {
    return <div className="text-center py-12 text-muted-foreground">Selecione um quadro para ver os artefatos.</div>;
  }
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <SEOHead title="Artefatos" path="/app/artifacts" />
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Artefatos</h1>
        <p className="text-sm text-muted-foreground">ADRs, relatórios, listas e modelos do quadro {board?.name ?? ""}</p>
      </div>
      <ArtifactsBrowser boardId={selectedBoardId} role={role} sprints={sprints.map((s) => ({ id: s.id, name: s.name }))} demands={demands as any} />
    </div>
  );
}
