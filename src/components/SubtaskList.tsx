import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask } from "@/hooks/useSubtasks";
import { toast } from "sonner";

interface SubtaskListProps {
  demandId: string;
  readOnly?: boolean;
}

export function SubtaskList({ demandId, readOnly = false }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const { data: subtasks, isLoading } = useSubtasks(demandId);
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  const completedCount = subtasks?.filter((s) => s.completed).length || 0;
  const totalCount = subtasks?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await createSubtask.mutateAsync({ demandId, title: newTitle.trim() });
      setNewTitle("");
      toast.success("Subtarefa adicionada");
    } catch {
      toast.error("Erro ao adicionar subtarefa");
    }
  };

  const handleToggle = async (id: string, completed: boolean) => {
    try {
      await updateSubtask.mutateAsync({ id, completed: !completed });
    } catch {
      toast.error("Erro ao atualizar subtarefa");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSubtask.mutateAsync({ id, demandId });
      toast.success("Subtarefa removida");
    } catch {
      toast.error("Erro ao remover subtarefa");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando subtarefas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Subtarefas</h4>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount} concluídas
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <Progress value={progress} className="h-2" />
      )}

      <div className="space-y-2">
        {subtasks?.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={() => handleToggle(subtask.id, subtask.completed)}
              disabled={readOnly}
            />
            <span className={`flex-1 text-sm ${subtask.completed ? "line-through text-muted-foreground" : ""}`}>
              {subtask.title}
            </span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => handleDelete(subtask.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            placeholder="Nova subtarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={!newTitle.trim() || createSubtask.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
