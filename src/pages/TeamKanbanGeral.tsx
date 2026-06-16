import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useAllTeamDemands } from "@/hooks/useAllTeamDemands";
import { useAllBoardsKanbanColumns } from "@/hooks/useAllBoardsKanbanColumns";
import { KanbanBoard } from "@/components/KanbanBoard";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kanban, Search, Info } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { SEOHead } from "@/components/SEOHead";

export default function TeamKanbanGeral() {
  const navigate = useNavigate();
  const { selectedTeamId, currentTeam } = useSelectedTeam();
  const { data: demands, isLoading } = useAllTeamDemands(selectedTeamId);
  const { columns: allBoardsKanbanColumns, isLoading: columnsLoading } = useAllBoardsKanbanColumns(selectedTeamId);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredDemands = useMemo(() => {
    if (!demands) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return demands;
    return demands.filter((d) => {
      const code = `${(d as any).boards?.name?.substring(0, 3).toUpperCase()}-${d.board_sequence_number}`.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        code.includes(q) ||
        (d as any).boards?.name?.toLowerCase().includes(q)
      );
    });
  }, [demands, searchQuery]);

  if (!selectedTeamId) {
    return (
      <div className="text-center py-12">
        <SEOHead title="Kanban Geral" path="/team-kanban" />
        <p className="text-muted-foreground">Selecione uma equipe primeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-full overflow-x-hidden">
      <SEOHead title="Kanban Geral" path="/team-kanban" />

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Kanban className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Kanban Geral
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão unificada de todos os seus quadros
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              O que é o Kanban Geral?
            </p>
            <p className="text-sm text-muted-foreground">
              O Kanban Geral reúne todas as demandas de todos os quadros em que você participa em uma única visualização. 
              As etapas (colunas) são unificadas — se dois quadros possuem a etapa "Fazendo", as demandas de ambos aparecem 
              na mesma coluna. Cada card exibe um badge com o nome do quadro de origem para facilitar a identificação.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar demanda ou quadro..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      {demands && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">{filteredDemands.length} demandas</Badge>
          {allBoardsKanbanColumns && (
            <Badge variant="outline">{allBoardsKanbanColumns.length} etapas</Badge>
          )}
        </div>
      )}

      {/* Kanban */}
      {isLoading || columnsLoading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground mt-4">Carregando kanban...</p>
        </div>
      ) : allBoardsKanbanColumns ? (
        <KanbanBoard
          demands={filteredDemands as any}
          columns={allBoardsKanbanColumns}
          onDemandClick={(id) => navigate(`/demands/${id}`, { state: { from: "team-kanban" } })}
          readOnly={true}
          showBoardBadge
          initialColumnsOpen
        />
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg bg-muted/20">
          <Kanban className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Nenhuma etapa encontrada
          </h3>
          <p className="text-muted-foreground mt-2">
            Não há etapas configuradas nos seus quadros
          </p>
        </div>
      )}
    </div>
  );
}
