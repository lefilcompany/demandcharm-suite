import { useState } from "react";
import { Trash2, RotateCcw, User, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useArchivedDemands } from "@/hooks/useArchivedDemands";
import { useUpdateDemand, useDeleteDemandPermanently } from "@/hooks/useDemands";
import { getStatusDisplayName } from "@/hooks/useBoardStatuses";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { truncateText, cn } from "@/lib/utils";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";

interface TrashDemandsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReadOnly?: boolean;
}

export const TRASH_RETENTION_DAYS = 30;

function daysUntilPurge(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  return Math.max(0, differenceInCalendarDays(new Date(expiresAt), new Date()));
}

export function TrashDemandsModal({ open, onOpenChange, isReadOnly = false }: TrashDemandsModalProps) {
  const navigate = useNavigate();
  const { selectedBoardId } = useSelectedBoard();
  const { data: demands, isLoading } = useArchivedDemands(selectedBoardId || undefined);
  const updateDemand = useUpdateDemand();
  const deleteDemand = useDeleteDemandPermanently();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteDemand.mutate(confirmDeleteId, {
      onSuccess: () => {
        toast.success("Demanda excluída definitivamente");
        setConfirmDeleteId(null);
      },
      onError: (error: any) => {
        toast.error("Erro ao excluir demanda", { description: getErrorMessage(error) });
        setConfirmDeleteId(null);
      },
    });
  };

  const confirmTarget = demands?.find((d) => d.id === confirmDeleteId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Lixeira
            </DialogTitle>
            <DialogDescription>
              Demandas descartadas ficam aqui por {TRASH_RETENTION_DAYS} dias e depois são apagadas
              definitivamente. Você pode restaurar ou excluir antes do prazo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                <p className="text-muted-foreground mt-4">Carregando...</p>
              </div>
            ) : demands && demands.length > 0 ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {demands.map((demand) => {
                  const days = daysUntilPurge((demand as any).trash_expires_at);
                  const urgent = days !== null && days <= 3;
                  return (
                    <Card
                      key={demand.id}
                      className="cursor-pointer hover:shadow-md transition-shadow opacity-80 hover:opacity-100"
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
                            <TooltipProvider delayDuration={300}>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => handleRestore(demand.id, e)}
                                      disabled={updateDemand.isPending || deleteDemand.isPending}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restaurar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(demand.id);
                                      }}
                                      disabled={updateDemand.isPending || deleteDemand.isPending}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir definitivamente</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
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
                              {getStatusDisplayName(demand.demand_statuses.name)}
                            </Badge>
                          )}
                          {days !== null && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] gap-1",
                                urgent
                                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                                  : "border-border text-muted-foreground"
                              )}
                            >
                              <Clock className="h-3 w-3" />
                              {days === 0 ? "Apaga hoje" : days === 1 ? "Apaga em 1 dia" : `Apaga em ${days} dias`}
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
                            Movida para a lixeira em{" "}
                            {format(new Date(demand.archived_at), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Trash2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">A lixeira está vazia</h3>
                <p className="text-muted-foreground mt-2">Demandas descartadas aparecerão aqui</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A demanda <strong>{confirmTarget ? truncateText(confirmTarget.title) : ""}</strong> e todo o seu
              histórico (chat, anexos, subdemandas e tempo registrado) serão apagados para sempre. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteDemand.isPending}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
