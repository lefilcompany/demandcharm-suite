import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatTimeDisplay } from "@/hooks/useLiveTimer";
import { useAuth } from "@/lib/auth";

interface TimeEntry {
  id: string;
  demand_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
}

interface TimeEntryEditDialogProps {
  entries: TimeEntry[];
  demandId: string;
  isLoading?: boolean;
}

function formatDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function TimeEntryRow({
  entry,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  entry: TimeEntry;
  onUpdate: (id: string, startedAt: string, endedAt: string | null) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [startedAt, setStartedAt] = useState(formatDateTimeLocal(entry.started_at));
  const [endedAt, setEndedAt] = useState(
    entry.ended_at ? formatDateTimeLocal(entry.ended_at) : ""
  );
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    const newStartedAt = new Date(startedAt).toISOString();
    const newEndedAt = endedAt ? new Date(endedAt).toISOString() : null;

    // Validation
    if (newEndedAt && new Date(newEndedAt) < new Date(newStartedAt)) {
      toast.error("Data de término deve ser após a data de início");
      return;
    }

    onUpdate(entry.id, newStartedAt, newEndedAt);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setStartedAt(formatDateTimeLocal(entry.started_at));
    setEndedAt(entry.ended_at ? formatDateTimeLocal(entry.ended_at) : "");
    setIsEditing(false);
  };

  const durationSeconds = entry.ended_at
    ? Math.floor((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 1000)
    : null;

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {format(new Date(entry.started_at), "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
                disabled={isUpdating || isDeleting}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    disabled={isUpdating || isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir entrada de tempo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A entrada de tempo será removida permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(entry.id)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Início</Label>
            <Input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Término {!entry.ended_at && "(em andamento)"}</Label>
            <Input
              type="datetime-local"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              className="h-8 text-xs"
              placeholder="Em andamento..."
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleSave}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span>
            {format(new Date(entry.started_at), "HH:mm", { locale: ptBR })}
            {" → "}
            {entry.ended_at
              ? format(new Date(entry.ended_at), "HH:mm", { locale: ptBR })
              : "em andamento"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {durationSeconds !== null
              ? formatTimeDisplay(durationSeconds)
              : "⏱️"}
          </span>
        </div>
      )}
    </div>
  );
}

export function TimeEntryEditDialog({
  entries,
  demandId,
  isLoading,
}: TimeEntryEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newStartedAt, setNewStartedAt] = useState("");
  const [newEndedAt, setNewEndedAt] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      startedAt,
      endedAt,
    }: {
      id: string;
      startedAt: string;
      endedAt: string | null;
    }) => {
      setUpdatingId(id);

      // Calculate duration if ended
      let durationSeconds = 0;
      if (endedAt) {
        durationSeconds = Math.floor(
          (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
        );
      }

      const { error } = await supabase
        .from("demand_time_entries")
        .update({
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["user-demand-time"] });
      toast.success("Entrada de tempo atualizada");
    },
    onError: (error) => {
      console.error("Error updating time entry:", error);
      toast.error("Erro ao atualizar entrada de tempo");
    },
    onSettled: () => {
      setUpdatingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);

      const { error } = await supabase
        .from("demand_time_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["user-demand-time"] });
      toast.success("Entrada de tempo excluída");
    },
    onError: (error) => {
      console.error("Error deleting time entry:", error);
      toast.error("Erro ao excluir entrada de tempo");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({
      startedAt,
      endedAt,
    }: {
      startedAt: string;
      endedAt: string;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const durationSeconds = Math.floor(
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
      );

      const { error } = await supabase.from("demand_time_entries").insert({
        demand_id: demandId,
        user_id: user.id,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["user-demand-time"] });
      toast.success("Entrada de tempo criada");
      setIsCreating(false);
      setNewStartedAt("");
      setNewEndedAt("");
    },
    onError: (error) => {
      console.error("Error creating time entry:", error);
      toast.error("Erro ao criar entrada de tempo");
    },
  });

  const handleUpdate = (id: string, startedAt: string, endedAt: string | null) => {
    updateMutation.mutate({ id, startedAt, endedAt });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleCreate = () => {
    if (!newStartedAt || !newEndedAt) {
      toast.error("Preencha os horários de início e término");
      return;
    }

    const startDate = new Date(newStartedAt);
    const endDate = new Date(newEndedAt);

    if (endDate <= startDate) {
      toast.error("Data de término deve ser após a data de início");
      return;
    }

    createMutation.mutate({
      startedAt: startDate.toISOString(),
      endedAt: endDate.toISOString(),
    });
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewStartedAt("");
    setNewEndedAt("");
  };

  // Filter to only show current user's entries
  const userEntries = entries.filter((e) => !e.ended_at || e.ended_at);

  const totalSeconds = userEntries.reduce((sum, entry) => {
    if (entry.ended_at) {
      return (
        sum +
        Math.floor(
          (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) /
            1000
        )
      );
    }
    return sum;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar entradas de tempo</DialogTitle>
          <DialogDescription>
            Corrija horários ou adicione entradas manualmente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Create new entry form */}
            {isCreating ? (
              <div className="border border-primary/30 rounded-lg p-3 space-y-3 bg-primary/5">
                <div className="text-sm font-medium">Nova entrada</div>
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="datetime-local"
                    value={newStartedAt}
                    onChange={(e) => setNewStartedAt(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Término</Label>
                  <Input
                    type="datetime-local"
                    value={newEndedAt}
                    onChange={(e) => setNewEndedAt(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs flex-1"
                    onClick={handleCancelCreate}
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar entrada manual
              </Button>
            )}

            {userEntries.length > 0 && (
              <ScrollArea className="max-h-[300px] pr-4">
                <div className="space-y-2">
                  {userEntries.map((entry) => (
                    <TimeEntryRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      isUpdating={updatingId === entry.id}
                      isDeleting={deletingId === entry.id}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {userEntries.length > 0 && (
              <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total registrado:</span>
                <span className="font-mono font-medium">
                  {formatTimeDisplay(totalSeconds)}
                </span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
