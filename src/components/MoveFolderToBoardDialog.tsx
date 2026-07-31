import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, LayoutGrid, FolderOpen } from "lucide-react";
import { useBoards } from "@/hooks/useBoards";
import { useMoveFolderToBoard } from "@/hooks/useDemandFolders";
import { cn } from "@/lib/utils";

interface MoveFolderToBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  folderId: string;
  folderName: string;
  currentBoardId?: string | null;
}

export function MoveFolderToBoardDialog({
  open,
  onOpenChange,
  teamId,
  folderId,
  folderName,
  currentBoardId,
}: MoveFolderToBoardDialogProps) {
  const { data: boards } = useBoards(teamId);
  const moveFolder = useMoveFolderToBoard();
  const [selected, setSelected] = useState<string | null>(currentBoardId ?? null);

  const handleConfirm = () => {
    moveFolder.mutate(
      { id: folderId, board_id: selected },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Mover projeto
          </DialogTitle>
          <DialogDescription>
            Escolha em qual quadro o projeto "{folderName}" deve aparecer. As demandas vinculadas não são alteradas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[320px] pr-2">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors",
                selected === null
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border/60 hover:bg-muted/60"
              )}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">Sem quadro (somente em "todos")</span>
              {selected === null && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>

            {boards?.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => setSelected(board.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors",
                  selected === board.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/60 hover:bg-muted/60"
                )}
              >
                <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{board.name}</span>
                {selected === board.id && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={moveFolder.isPending}>
            {moveFolder.isPending ? "Movendo..." : "Mover projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
