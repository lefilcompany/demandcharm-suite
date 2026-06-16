import { Archive, RotateCcw, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useArchivedDemands } from "@/hooks/useArchivedDemands";
import { useUpdateDemand } from "@/hooks/useDemands";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { truncateText } from "@/lib/utils";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";

interface ArchivedDemandsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReadOnly?: boolean;
}

export function ArchivedDemandsModal({ open, onOpenChange, isReadOnly = false }: ArchivedDemandsModalProps) {
  const navigate = useNavigate();
  const { selectedBoardId } = useSelectedBoard();
  const { data: demands, isLoading } = useArchivedDemands(selectedBoardId || undefined);
  const updateDemand = useUpdateDemand();

  const handleRestore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateDemand.mutate(
      { id, archived: false, archived_at: null },
      {
        onSuccess: () => toast.success("Demanda restaurada com sucesso!"),
        onError: (error: any) => toast.error("Erro ao restaurar demanda", { description: getErrorMessage(error) }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Demandas Arquivadas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-muted-foreground mt-4">Carregando...</p>
            </div>
          ) : demands && demands.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {demands.map((demand) => (
                <Card
                  key={demand.id}
                  className="cursor-pointer hover:shadow-md transition-shadow opacity-75 hover:opacity-100"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/demands/${demand.id}`);
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm line-clamp-2" title={demand.title}>
                        {truncateText(demand.title)}
                      </CardTitle>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => handleRestore(demand.id, e)}
                          disabled={updateDemand.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {demand.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        <RichTextDisplay content={demand.description} />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {demand.demand_statuses && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            backgroundColor: `${demand.demand_statuses.color}20`,
                            color: demand.demand_statuses.color,
                            borderColor: `${demand.demand_statuses.color}40`,
                          }}
                        >
                          {demand.demand_statuses.name}
                        </Badge>
                      )}
                    </div>
                    {(demand as any).profiles?.full_name && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{(demand as any).profiles.full_name}</span>
                      </div>
                    )}
                    {demand.archived_at && (
                      <p className="text-[11px] text-muted-foreground">
                        Arquivada em {format(new Date(demand.archived_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma demanda arquivada</h3>
              <p className="text-muted-foreground mt-2">Demandas arquivadas aparecerão aqui</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
