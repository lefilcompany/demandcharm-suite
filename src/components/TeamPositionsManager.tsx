import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useTeamPositions,
  useCreatePosition,
  useUpdatePosition,
  TeamPosition,
} from "@/hooks/useTeamPositions";
import { CreatePositionDialog } from "@/components/CreatePositionDialog";
import { PositionBadge } from "@/components/PositionBadge";

interface TeamPositionsManagerProps {
  teamId: string;
  canManage: boolean;
  isAdmin: boolean;
}

export function TeamPositionsManager({ teamId, canManage }: TeamPositionsManagerProps) {
  const { data: positions, isLoading } = useTeamPositions(teamId);
  const createPosition = useCreatePosition();
  const updatePosition = useUpdatePosition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<TeamPosition | null>(null);

  const handleCreateOrUpdate = async (data: { name: string; description?: string; color: string; textColor: string }) => {
    try {
      if (editingPosition) {
        await updatePosition.mutateAsync({
          positionId: editingPosition.id,
          teamId,
          ...data,
        });
        toast.success("Cargo atualizado com sucesso!");
      } else {
        await createPosition.mutateAsync({
          teamId,
          ...data,
        });
        toast.success("Cargo criado com sucesso!");
      }
      setDialogOpen(false);
      setEditingPosition(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cargo");
    }
  };

  const handleOpenCreate = () => {
    setEditingPosition(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="flex-1">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <Briefcase className="h-5 w-5 shrink-0" />
            Cargos da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!positions || positions.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/70 px-3 py-2.5">
              <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado</p>
              {canManage && (
                <Button
                  onClick={handleOpenCreate}
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Criar cargo
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {positions.map((position) => (
                <PositionBadge
                  key={position.id}
                  name={position.name}
                  color={position.color}
                  textColor={position.text_color}
                />
              ))}
              {canManage && (
                <Button
                  onClick={handleOpenCreate}
                  variant="ghost"
                  className="h-6 rounded-full border border-dashed border-input bg-transparent px-2.5 text-xs font-medium text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary"
                >
                  <Plus className="h-3 w-3" />
                  Criar Cargo
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePositionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPosition(null);
        }}
        onSubmit={handleCreateOrUpdate}
        isLoading={createPosition.isPending || updatePosition.isPending}
        editingPosition={editingPosition}
      />
    </>
  );
}
