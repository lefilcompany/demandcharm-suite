import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eraser } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  boardId: string;
  deliveredVisible: number;
  openCount: number;
}

export function ClearBoardKanbanDialog({ boardId, deliveredVisible, openCount }: Props) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    const { error } = await supabase.rpc("clear_board_kanban", { _board_id: boardId });
    setPending(false);
    if (error) { toast.error(error.message || "Não foi possível limpar o quadro"); return; }
    qc.invalidateQueries({ queryKey: ["board", boardId] });
    qc.invalidateQueries({ queryKey: ["boards"] });
    toast.success("Kanban limpo: entregues saíram do quadro");
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
          <Eraser className="h-4 w-4" />
          <span className="hidden sm:inline">Limpar quadro</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpar o Kanban deste quadro?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p><b>{deliveredVisible}</b> demanda(s) entregue(s) vão sair do Kanban agora.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nada é excluído: elas continuam na página Demandas, nos relatórios e na busca.</li>
                <li className="text-foreground font-medium">
                  As demandas ainda abertas ({openCount}) não serão limpas e continuam no Kanban.
                </li>
                <li>A limpeza vale para todos os membros do quadro.</li>
                <li>Demandas entregues depois da limpeza aparecem normalmente e somem após 31 dias.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending || deliveredVisible === 0}>
            Limpar quadro
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
