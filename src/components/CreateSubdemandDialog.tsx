import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { AssigneeSelector } from "@/components/AssigneeSelector";
import { ServiceSelector } from "@/components/ServiceSelector";
import { InlineFileUploader, PendingFile } from "@/components/InlineFileUploader";
import { GitBranch, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { SubdemandInput } from "@/hooks/useSubdemands";

export interface SubdemandFormData extends SubdemandInput {
  tempId: string;
  dependsOnIndex?: number;
  assigneeIds?: string[];
  pendingFiles?: PendingFile[];
}

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

interface CreateSubdemandDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: SubdemandFormData) => void;
  existingSubdemands: SubdemandFormData[];
  editingIndex?: number;
  editingData?: SubdemandFormData | null;
  parentServiceId?: string;
  parentServiceName?: string;
  statuses: StatusOption[];
  defaultStatusId: string;
  teamId: string | null;
  boardId: string | null;
  parentAssigneeIds?: string[];
}

export function CreateSubdemandDialog({
  open,
  onClose,
  onSave,
  existingSubdemands,
  editingIndex,
  editingData,
  parentServiceId,
  parentServiceName,
  statuses,
  defaultStatusId,
  teamId,
  boardId,
  parentAssigneeIds,
}: CreateSubdemandDialogProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("média");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dependsOnIndex, setDependsOnIndex] = useState<number | undefined>(undefined);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const isEditing = editingData != null;

  useEffect(() => {
    if (open && editingData) {
      setTitle(editingData.title);
      setPriority(editingData.priority || "média");
      setDescription(editingData.description || "");
      setStatusId(editingData.status_id || defaultStatusId);
      setDueDate(editingData.due_date || "");
      setServiceId(editingData.service_id || parentServiceId || "");
      setAssigneeIds(editingData.assigneeIds || []);
      setDependsOnIndex(editingData.dependsOnIndex);
      setPendingFiles(editingData.pendingFiles || []);
    } else if (open) {
      setTitle("");
      setPriority("média");
      setDescription("");
      setStatusId(defaultStatusId);
      setDueDate("");
      setServiceId(parentServiceId || "");
      setAssigneeIds([]);
      setDependsOnIndex(undefined);
      setPendingFiles([]);
    }
  }, [open, editingData, defaultStatusId, parentServiceId]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (assigneeIds.length === 0) {
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
    onSave({
      tempId: editingData?.tempId || crypto.randomUUID(),
      title: title.trim(),
      priority,
      description: description.trim() || undefined,
      status_id: statusId || undefined,
      service_id: serviceId || undefined,
      due_date: dueDate || undefined,
      assigned_to: assigneeIds[0] || undefined,
      assigneeIds,
      dependsOnIndex,
      pendingFiles: pendingFiles.length > 0 ? pendingFiles : undefined,
    });
    onClose();
  };

  const isFormValid = !!title.trim() && assigneeIds.length > 0 && !!priority && !!dueDate;

  const availableDeps = existingSubdemands
    .map((s, i) => ({ ...s, idx: i }))
    .filter(({ idx }) => idx !== editingIndex);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-[#F28705]" />
            {isEditing ? "Editar Subdemanda" : "Nova Subdemanda"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="sub-title">Título *</Label>
            <Input
              id="sub-title"
              placeholder="Ex: Criar layout da tela"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>

          {/* Service + Assignees */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <ServiceSelector
                teamId={teamId}
                boardId={boardId}
                value={serviceId}
                onChange={(id) => setServiceId(id)}
              />
            </div>
            <div className="space-y-2">
              <Label>Responsáveis *</Label>
              <AssigneeSelector
                teamId={teamId}
                boardId={boardId}
                selectedUserIds={assigneeIds}
                onChange={setAssigneeIds}
                hideIcon
                restrictToUserIds={parentAssigneeIds}
              />
            </div>
          </div>

          {/* Status + Priority + Due Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade *</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="média">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Entrega *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8"
                required
              />
            </div>
          </div>

          {/* Dependency */}
          {existingSubdemands.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="whitespace-nowrap text-sm">Pode iniciar quando</Label>
              <Select
                value={dependsOnIndex !== undefined ? String(dependsOnIndex) : "none"}
                onValueChange={(v) => setDependsOnIndex(v === "none" ? undefined : Number(v))}
              >
                <SelectTrigger className="h-8 w-auto min-w-[180px] max-w-[240px]">
                  <SelectValue placeholder="Selecionar Subdemanda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {availableDeps.map(({ idx, title: t }) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Sub {idx + 1}: {t || "(sem título)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground whitespace-nowrap">for concluída</span>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                    Define uma dependência: esta subdemanda só poderá ser iniciada após a subdemanda selecionada ser concluída (status "Entregue").
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Descreva os detalhes da subdemanda..."
              minHeight="80px"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Anexos</Label>
            <InlineFileUploader
              pendingFiles={pendingFiles}
              onFilesChange={setPendingFiles}
              disabled={false}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} size="sm">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid}
            size="sm"
            className="bg-[#F28705] text-white border border-transparent hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
          >
            {isEditing ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
