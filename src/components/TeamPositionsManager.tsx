import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
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
          <CardDescription className="leading-relaxed">
            Crie cargos personalizados por área ou função
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!positions || positions.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/30">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Nenhum cargo cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie cargos para organizar sua equipe por área ou função (ex: Desenvolvedor, Designer, Analista)
              </p>
              {canManage && (
                <Button onClick={handleOpenCreate} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro cargo
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {positions.map((position) => (
                <PositionBadge
                  key={position.id}
                  name={position.name}
                  color={position.color}
                  textColor={position.text_color}
                />
              ))}
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
