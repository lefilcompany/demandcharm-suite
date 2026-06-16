import { Button } from "@/components/ui/button";
import { useArchivedDemands } from "@/hooks/useArchivedDemands";
import { useUpdateDemand } from "@/hooks/useDemands";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Archive, RotateCcw, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { truncateText } from "@/lib/utils";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";
import { SEOHead } from "@/components/SEOHead";

export default function ArchivedDemands() {
  const navigate = useNavigate();
  const { selectedBoardId } = useSelectedBoard();
  const { data: demands, isLoading } = useArchivedDemands(selectedBoardId || undefined);
  const updateDemand = useUpdateDemand();

  const handleRestore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateDemand.mutate(
      {
        id,
        archived: false,
        archived_at: null,
      },
      {
        onSuccess: () => {
          toast.success("Demanda restaurada com sucesso!");
        },
        onError: (error: any) => {
          toast.error("Erro ao restaurar demanda", {
            description: getErrorMessage(error),
          });
        },
      }
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <SEOHead title="Demandas Arquivadas" path="/archived-demands" />
      <PageBreadcrumb
        items={[
          { label: "Arquivadas", icon: Archive, isCurrent: true },
        ]}
      />
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Archive className="h-7 w-7 md:h-8 md:w-8" />
          Arquivadas
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Demandas arquivadas do sistema
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando demandas...</p>
        </div>
      ) : demands && demands.length > 0 ? (
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {demands.map((demand) => (
            <Card 
              key={demand.id} 
              className="cursor-pointer hover:shadow-md transition-shadow opacity-75 hover:opacity-100"
              onClick={() => navigate(`/demands/${demand.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2" title={demand.title}>
                    {truncateText(demand.title)}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => handleRestore(demand.id, e)}
                    disabled={updateDemand.isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {demand.description && (
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    <RichTextDisplay content={demand.description} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {demand.demand_statuses && (
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: `${demand.demand_statuses.color}20`,
                        color: demand.demand_statuses.color,
                        borderColor: `${demand.demand_statuses.color}40`,
                      }}
                    >
                      {demand.demand_statuses.name}
                    </Badge>
                  )}
                  {demand.teams && (
                    <Badge variant="secondary">{demand.teams.name}</Badge>
                  )}
                </div>
                {(demand as any).profiles?.full_name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Solicitante: {(demand as any).profiles.full_name}</span>
                  </div>
                )}
                {demand.archived_at && (
                  <p className="text-xs text-muted-foreground">
                    Arquivada em {format(new Date(demand.archived_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">
            Nenhuma demanda arquivada
          </h3>
          <p className="text-muted-foreground mt-2">
            Demandas arquivadas aparecerão aqui
          </p>
        </div>
      )}
    </div>
  );
}
