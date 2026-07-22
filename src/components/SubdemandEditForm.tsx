import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDemandStatuses, useUpdateDemand } from "@/hooks/useDemands";
import { ServiceSelector } from "@/components/ServiceSelector";
import { AssigneeSelector } from "@/components/AssigneeSelector";
import { useDemandAssignees, useSetAssignees } from "@/hooks/useDemandAssignees";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";
import { useHasBoardServices } from "@/hooks/useBoardServices";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useNavigationBlock } from "@/hooks/useNavigationBlock";
import { calculateBusinessDueDate, formatDueDateForInput, toDateOnly } from "@/lib/dateUtils";
import { useSubdemands, useUpdateSubdemandDependency } from "@/hooks/useSubdemands";
import { useDemandDependencyInfo } from "@/hooks/useDependencyCheck";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { Package, Users, Loader2, Link2, Lock, X, GitBranch, Unlink2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConvertToSubdemand } from "@/hooks/useSubdemands";
import { LinkAsSubdemandDialog } from "@/components/LinkAsSubdemandDialog";
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
import { getErrorMessage as _getErr } from "@/lib/errorUtils";

interface SubdemandEditFormProps {
  demand: {
    id: string;
    title: string;
    description: string | null;
    status_id: string;
    priority: string | null;
    due_date: string | null;
    service_id: string | null;
    team_id: string;
    board_id: string;
    parent_demand_id: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const NONE_VALUE = "__none__";

export function SubdemandEditForm({ demand, onClose, onSuccess }: SubdemandEditFormProps) {
  const updateDemand = useUpdateDemand();
  const setAssignees = useSetAssignees();
  const updateDependency = useUpdateSubdemandDependency();
  const { data: statuses } = useDemandStatuses();
  const { data: boardStatuses } = useBoardStatuses(demand.board_id);
  const { data: currentAssignees } = useDemandAssignees(demand.id);
  const { data: boardRole } = useBoardRole(demand.board_id);
  const { hasBoardServices } = useHasBoardServices(demand.board_id);

  const { data: siblingSubdemands } = useSubdemands(demand.parent_demand_id);
  const { data: currentDeps } = useDemandDependencyInfo(demand.id);
  const [reverseDependents, setReverseDependents] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("demand_dependencies")
        .select("demand_id")
        .eq("depends_on_demand_id", demand.id);
      if (cancelled) return;
      setReverseDependents(new Set((data || []).map((d: any) => d.demand_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [demand.id]);

  const canAssignResponsibles = boardRole !== "requester";

  const [title, setTitle] = useState(demand.title);
  const [description, setDescription] = useState(demand.description || "");
  const [statusId, setStatusId] = useState(demand.status_id);
  const [priority, setPriority] = useState(demand.priority || "média");
  const [dueDate, setDueDate] = useState(toDateOnly(demand.due_date) || "");
  const [serviceId, setServiceId] = useState(demand.service_id || "");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [primaryAssignee, setPrimaryAssignee] = useState<string | null>(null);
  const [dependsOnId, setDependsOnId] = useState<string>(NONE_VALUE);
  const [initialDependsOnId, setInitialDependsOnId] = useState<string>(NONE_VALUE);

  const statusOptions = useMemo(() => {
    if (boardStatuses && boardStatuses.length > 0) {
      return boardStatuses.map((bs) => ({
        id: bs.status.id,
        name: bs.status.name,
        color: bs.status.color,
      }));
    }
    return statuses || [];
  }, [boardStatuses, statuses]);

  useEffect(() => {
    if (currentAssignees) {
      setSelectedAssignees(currentAssignees.map((a) => a.user_id));
      const primary = currentAssignees.find((a) => a.is_primary)?.user_id ?? currentAssignees[0]?.user_id ?? null;
      setPrimaryAssignee(primary);
    }
  }, [currentAssignees]);

  useEffect(() => {
    if (currentDeps && currentDeps.length > 0) {
      const first = currentDeps[0].dependsOnDemandId;
      setDependsOnId(first);
      setInitialDependsOnId(first);
    } else {
      setDependsOnId(NONE_VALUE);
      setInitialDependsOnId(NONE_VALUE);
    }
  }, [currentDeps]);

  const dependencyOptions = useMemo(() => {
    if (!siblingSubdemands) return [];
    const self = siblingSubdemands.find((s) => s.id === demand.id);
    const selfCreatedAt = self?.created_at ? new Date(self.created_at).getTime() : null;
    return siblingSubdemands.filter((s) => {
      if (s.id === demand.id) return false;
      if (reverseDependents.has(s.id)) return false;
      // Only allow depending on siblings created BEFORE the current subdemand
      if (selfCreatedAt !== null && s.created_at) {
        if (new Date(s.created_at).getTime() >= selfCreatedAt) return false;
      }
      return true;
    });
  }, [siblingSubdemands, demand.id, reverseDependents]);

  const currentDependencyTitle = useMemo(() => {
    if (dependsOnId === NONE_VALUE) return null;
    const found = siblingSubdemands?.find((s) => s.id === dependsOnId);
    return found?.title ?? currentDeps?.[0]?.dependsOnTitle ?? "Subdemanda";
  }, [dependsOnId, siblingSubdemands, currentDeps]);

  // Hide entire dependency section if this is the first subdemand (no older siblings)
  // AND there is no existing dependency to manage.
  const hasExistingDependency = dependsOnId !== NONE_VALUE && !!currentDependencyTitle;
  const showDependencySection = hasExistingDependency || dependencyOptions.length > 0;

  const draftFields = useMemo(
    () => ({ title, description, statusId, priority, dueDate, serviceId, selectedAssignees, dependsOnId }),
    [title, description, statusId, priority, dueDate, serviceId, selectedAssignees, dependsOnId]
  );

  const draftSetters = useMemo(
    () => ({
      title: setTitle,
      description: setDescription,
      statusId: setStatusId,
      priority: setPriority,
      dueDate: setDueDate,
      serviceId: setServiceId,
      selectedAssignees: setSelectedAssignees,
      dependsOnId: setDependsOnId,
    }),
    []
  );

  const { hasContent, clearDraft } = useFormDraft({
    formId: `edit-subdemand-${demand.id}`,
    fields: draftFields,
    setters: draftSetters,
  });

  const { isBlocked, confirmNavigation, cancelNavigation, setDontShowAgain } = useNavigationBlock({
    shouldBlock: hasContent(),
  });

  const handleServiceChange = (newServiceId: string, estimatedHours?: number) => {
    setServiceId(newServiceId);
    if (newServiceId !== "none" && estimatedHours) {
      const calculatedDate = calculateBusinessDueDate(estimatedHours);
      setDueDate(formatDueDateForInput(calculatedDate));
    }
  };

  const handleClearDependency = () => {
    setDependsOnId(NONE_VALUE);
  };

  const initialAssigneeIds = useMemo(
    () => (currentAssignees || []).map((a) => a.user_id).sort(),
    [currentAssignees]
  );

  const hasChanges = useMemo(() => {
    if (title !== demand.title) return true;
    if ((description || "") !== (demand.description || "")) return true;
    if (statusId !== demand.status_id) return true;
    if (priority !== (demand.priority || "média")) return true;
    if (dueDate !== (toDateOnly(demand.due_date) || "")) return true;
    if ((serviceId || "") !== (demand.service_id || "")) return true;
    if (dependsOnId !== initialDependsOnId) return true;
    const sortedSelected = [...selectedAssignees].sort();
    if (sortedSelected.length !== initialAssigneeIds.length) return true;
    if (sortedSelected.some((id, i) => id !== initialAssigneeIds[i])) return true;
    return false;
  }, [
    title,
    description,
    statusId,
    priority,
    dueDate,
    serviceId,
    dependsOnId,
    initialDependsOnId,
    selectedAssignees,
    initialAssigneeIds,
    demand,
  ]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !statusId) return;

    if (!priority) {
      toast.error("Defina a prioridade da subdemanda");
      return;
    }
    if (!dueDate) {
      toast.error("A data de entrega é obrigatória");
      return;
    }
    if (canAssignResponsibles && selectedAssignees.length === 0) {
      toast.error("Selecione pelo menos um responsável");
      return;
    }

    try {
      await updateDemand.mutateAsync({
        id: demand.id,
        title: title.trim(),
        description: description.trim() || null,
        status_id: statusId,
        priority,
        due_date: dueDate,
        service_id: serviceId && serviceId !== "none" ? serviceId : null,
      });

      await setAssignees.mutateAsync({
        demandId: demand.id,
        userIds: selectedAssignees,
        primaryUserId: primaryAssignee,
      });

      if (dependsOnId !== initialDependsOnId) {
        await updateDependency.mutateAsync({
          demandId: demand.id,
          dependsOnDemandId: dependsOnId === NONE_VALUE ? null : dependsOnId,
        });
      }

      clearDraft();
      toast.success("Subdemanda atualizada!");
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao atualizar subdemanda", {
        description: getErrorMessage(error),
      });
    }
  };

  const isSaving = updateDemand.isPending || setAssignees.isPending || updateDependency.isPending;

  return (
    <>
      <UnsavedChangesDialog
        open={isBlocked}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        onDontShowAgain={setDontShowAgain}
      />

      <DialogHeader className="shrink-0 px-6 pt-6 pb-3 space-y-1">
        <DialogTitle className="text-xl font-bold">Editar Subdemanda</DialogTitle>
        <p className="text-sm text-muted-foreground">Atualize os dados desta subdemanda</p>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-sub-title">Título *</Label>
              <Input
                id="edit-sub-title"
                placeholder="Ex: Implementar nova funcionalidade"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-8"
              />
            </div>

            <div className={`grid gap-4 grid-cols-1 ${canAssignResponsibles ? "sm:grid-cols-2" : ""}`}>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Serviço {hasBoardServices ? "*" : ""}
                </Label>
                <ServiceSelector
                  teamId={demand.team_id}
                  boardId={demand.board_id}
                  value={serviceId}
                  onChange={handleServiceChange}
                  userRole={boardRole}
                />
              </div>

              {canAssignResponsibles && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Responsáveis *
                  </Label>
                  <AssigneeSelector
                    teamId={demand.team_id}
                    boardId={demand.board_id}
                    selectedUserIds={selectedAssignees}
                    onChange={setSelectedAssignees}
                    primaryUserId={primaryAssignee}
                    onPrimaryChange={setPrimaryAssignee}
                    hideIcon
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-sub-status">Status *</Label>
                <Select value={statusId} onValueChange={setStatusId} required>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions?.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sub-priority">Prioridade *</Label>
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
                <Label htmlFor="edit-sub-dueDate">Data de Entrega *</Label>
                <Input
                  id="edit-sub-dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8"
                  required
                />
              </div>
            </div>

            {showDependencySection && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#F28705]" />
                Dependência
              </Label>

              {dependsOnId !== NONE_VALUE && currentDependencyTitle && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-[#F28705]/30 bg-[#F28705]/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Lock className="h-3.5 w-3.5 text-[#F28705] shrink-0" />
                    <span className="text-sm truncate">
                      Atualmente depende de:{" "}
                      <span className="font-semibold">{currentDependencyTitle}</span>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-[#F28705] hover:bg-[#F28705]/20 hover:text-[#F28705]"
                    onClick={handleClearDependency}
                    title="Remover dependência"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {!(dependsOnId !== NONE_VALUE && currentDependencyTitle) && (
                <div className="space-y-1">
                  <Label
                    htmlFor="edit-sub-dependency"
                    className="text-xs text-muted-foreground font-normal"
                  >
                    Pode iniciar quando esta subdemanda for entregue:
                  </Label>
                  <Select value={dependsOnId} onValueChange={setDependsOnId}>
                    <SelectTrigger id="edit-sub-dependency" className="h-8">
                      <SelectValue placeholder="Selecionar subdemanda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Nenhuma (sem dependência)</SelectItem>
                      {dependencyOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dependencyOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Não há outras subdemandas elegíveis para vincular como dependência.
                    </p>
                  )}
                </div>
              )}
            </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-sub-description">Descrição</Label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Descreva os detalhes da subdemanda..."
                minHeight="140px"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 py-2 flex items-center justify-end gap-2 bg-card border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || !hasChanges}
            className="bg-[#F28705] text-white border border-transparent hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
