import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateDemandRequest } from "@/hooks/useDemandRequests";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardServices } from "@/hooks/useBoardServices";
import { useFormDraft } from "@/hooks/useFormDraft";
import { toast } from "sonner";
import { Calendar, Loader2, Send } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";

interface CreateRequestQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
}

export function CreateRequestQuickDialog({
  open,
  onOpenChange,
  selectedDate,
}: CreateRequestQuickDialogProps) {
  const navigate = useNavigate();
  const { selectedBoardId, currentTeamId } = useSelectedBoard();
  const { data: boardServices } = useBoardServices(selectedBoardId || undefined);
  const createRequest = useCreateDemandRequest();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("média");
  const [serviceId, setServiceId] = useState<string>("");

  // Draft persistence
  const draftFields = useMemo(
    () => ({
      title,
      description,
      priority,
      serviceId,
    }),
    [title, description, priority, serviceId]
  );

  const draftSetters = useMemo(
    () => ({
      title: setTitle,
      description: setDescription,
      priority: setPriority,
      serviceId: setServiceId,
    }),
    []
  );

  const { clearDraft } = useFormDraft({
    formId: `quick-request-${selectedBoardId || "default"}`,
    fields: draftFields,
    setters: draftSetters,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    if (!description.trim()) {
      toast.error("A descrição é obrigatória");
      return;
    }

    if (!serviceId || serviceId === "none") {
      toast.error("Selecione um serviço");
      return;
    }

    if (!selectedBoardId || !currentTeamId) {
      toast.error("Selecione um quadro primeiro");
      return;
    }

    try {
      await createRequest.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
        board_id: selectedBoardId,
        team_id: currentTeamId,
        service_id: serviceId,
      });

      // Clear draft on success
      clearDraft();

      toast.success("Solicitação enviada!", {
        description: "Aguarde a aprovação de um administrador ou coordenador.",
      });
      onOpenChange(false);
      resetForm();
      
      // Navigate to my requests
      navigate("/demand-requests");
    } catch (error) {
      toast.error("Erro ao criar solicitação", {
        description: getErrorMessage(error),
      });
      console.error("Error creating request:", error);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("média");
    setServiceId("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
      clearDraft();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Nova Solicitação
          </DialogTitle>
          <DialogDescription>
            {selectedDate ? (
              <span>
                Solicitação para{" "}
                <strong className="text-foreground">
                  {format(selectedDate, "d 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </strong>
                . Um administrador ou coordenador irá revisar e aprovar.
              </span>
            ) : (
              <span>
                Um administrador ou coordenador irá revisar e aprovar sua solicitação.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título da solicitação"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Descreva os detalhes do que você precisa..."
              minHeight="100px"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      Baixa
                    </div>
                  </SelectItem>
                  <SelectItem value="média">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      Média
                    </div>
                  </SelectItem>
                  <SelectItem value="alta">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      Alta
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {boardServices?.map((bs) => (
                    <SelectItem key={bs.service.id} value={bs.service.id}>
                      {bs.service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createRequest.isPending}>
              {createRequest.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Send className="mr-2 h-4 w-4" />
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
