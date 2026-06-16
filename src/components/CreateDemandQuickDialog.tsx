import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { useCreateDemand, useDemandStatuses } from "@/hooks/useDemands";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardServices } from "@/hooks/useBoardServices";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { AssigneeSelector } from "@/components/AssigneeSelector";
import { supabase } from "@/integrations/supabase/client";
import { RecurrenceConfig, RecurrenceData, defaultRecurrenceData } from "@/components/RecurrenceConfig";
import { useCreateRecurringDemand } from "@/hooks/useRecurringDemands";
import { toast } from "sonner";
import { Calendar, Loader2 } from "lucide-react";

interface CreateDemandQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
}

export function CreateDemandQuickDialog({
  open,
  onOpenChange,
  selectedDate,
}: CreateDemandQuickDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedBoardId, currentTeamId } = useSelectedBoard();
  const { data: statuses } = useDemandStatuses();
  const { data: boardServices } = useBoardServices(selectedBoardId || undefined);
  const { data: boardRole } = useBoardRole(selectedBoardId);
  const createDemand = useCreateDemand();

  const canAssignResponsibles = boardRole !== "requester";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("média");
  const [serviceId, setServiceId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const [recurrence, setRecurrence] = useState<RecurrenceData>(defaultRecurrenceData);

  const createRecurringDemand = useCreateRecurringDemand();

  // Draft persistence
  const draftFields = useMemo(
    () => ({
      title,
      description,
      priority,
      serviceId,
      statusId,
    }),
    [title, description, priority, serviceId, statusId]
  );

  const draftSetters = useMemo(
    () => ({
      title: setTitle,
      description: setDescription,
      priority: setPriority,
      serviceId: setServiceId,
      statusId: setStatusId,
    }),
    []
  );

  const { clearDraft } = useFormDraft({
    formId: `quick-demand-${selectedBoardId || "default"}`,
    fields: draftFields,
    setters: draftSetters,
  });

  // Find default status (first non-delivered status or first status)
  const defaultStatusId =
    statuses?.find((s) => s.name !== "Entregue")?.id || statuses?.[0]?.id || "";

  // Initialize dueDate from selectedDate when dialog opens
  useEffect(() => {
    if (open && selectedDate && !dueDate) {
      setDueDate(format(selectedDate, "yyyy-MM-dd"));
    }
  }, [open, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    if (!selectedBoardId || !currentTeamId) {
      toast.error("Selecione um quadro primeiro");
      return;
    }

    if (canAssignResponsibles && assigneeIds.length === 0) {
      toast.error("Selecione pelo menos um responsável");
      return;
    }

    if (!priority) {
      toast.error("Defina a prioridade");
      return;
    }

    if (!dueDate) {
      toast.error("Defina a data de entrega");
      return;
    }

    try {
      const result = await createDemand.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status_id: statusId || defaultStatusId,
        due_date: dueDate,
        board_id: selectedBoardId,
        team_id: currentTeamId,
        service_id: serviceId || null,
      });

      // Assign responsibles
      if (result?.id && assigneeIds.length > 0) {
        const primary = primaryAssigneeId && assigneeIds.includes(primaryAssigneeId) ? primaryAssigneeId : assigneeIds[0];
        await supabase
          .from("demand_assignees")
          .insert(assigneeIds.map((userId) => ({ demand_id: result.id, user_id: userId, is_primary: userId === primary })));
      }

      // Clear draft on success
      clearDraft();

      // Create recurring demand if recurrence is enabled
      if (recurrence.enabled && result && selectedBoardId && currentTeamId) {
        try {
          const created = await createRecurringDemand.mutateAsync({
            team_id: currentTeamId,
            board_id: selectedBoardId,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            status_id: statusId || defaultStatusId,
            service_id: serviceId || null,
            assignee_ids: assigneeIds,
            frequency: recurrence.frequency,
            weekdays:
              recurrence.frequency === "weekly" || recurrence.frequency === "biweekly"
                ? recurrence.weekdays
                : [],
            day_of_month: recurrence.frequency === "monthly" ? recurrence.dayOfMonth : null,
            start_date: recurrence.startDate,
            end_date: recurrence.endDate || null,
          });

          // Vincula a demanda recém-criada à regra de recorrência (vínculo persistente por ID)
          if (created?.id && result?.id) {
            await supabase
              .from("demands")
              .update({ recurring_demand_id: created.id })
              .eq("id", result.id);
          }
        } catch (recError: any) {
          console.error("Erro ao criar recorrência:", recError);
          const msg = recError?.message || "Erro desconhecido";
          toast.error(`Demanda criada, mas a recorrência falhou: ${msg}`);
        }
      }

      toast.success("Demanda criada com sucesso!");
      onOpenChange(false);
      resetForm();

      // Navigate to the new demand
      if (result?.id) {
        navigate(`/demands/${result.id}`);
      }
    } catch (error) {
      // The useCreateDemand hook already shows a friendly toast for plan-limit errors.
      const msg = error instanceof Error ? error.message : "";
      if (!/PLAN_LIMIT_/.test(msg)) {
        toast.error("Erro ao criar demanda");
      }
      console.error("Error creating demand:", error);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("média");
    setServiceId("");
    setStatusId("");
    setAssigneeIds([]);
    setDueDate("");
    setRecurrence(defaultRecurrenceData);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Nova Demanda
          </DialogTitle>
          <DialogDescription>
            {selectedDate && (
              <span>
                Criando demanda para{" "}
                <strong className="text-foreground">
                  {format(selectedDate, "d 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </strong>
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
              placeholder="Digite o título da demanda"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Descreva a demanda (opcional)"
              minHeight="100px"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade *</Label>
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
              <Label htmlFor="quick-due-date">Data de Entrega *</Label>
              <Input
                id="quick-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {canAssignResponsibles && (
            <div className="space-y-2">
              <Label>Responsáveis *</Label>
              <AssigneeSelector
                teamId={currentTeamId}
                boardId={selectedBoardId}
                selectedUserIds={assigneeIds}
                onChange={setAssigneeIds}
                primaryUserId={primaryAssigneeId}
                onPrimaryChange={setPrimaryAssigneeId}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={statusId || defaultStatusId}
              onValueChange={setStatusId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {statuses?.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {boardServices && boardServices.length > 0 && (
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {boardServices.map((bs) => (
                    <SelectItem key={bs.service.id} value={bs.service.id}>
                      {bs.service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurrence Config */}
          <RecurrenceConfig value={recurrence} onChange={setRecurrence} compact />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createDemand.isPending}>
              {createDemand.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar Demanda
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
