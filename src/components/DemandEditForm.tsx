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
import { RecurrenceConfig, RecurrenceData, defaultRecurrenceData } from "@/components/RecurrenceConfig";
import { useRecurringDemands, useCreateRecurringDemand, useUpdateRecurringDemand, useDeleteRecurringDemand } from "@/hooks/useRecurringDemands";
import { useAddSubdemand } from "@/hooks/useSubdemands";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { GitBranch, Plus, Minus, ChevronLeft, ChevronRight, Trash2, Package, Users, Loader2 } from "lucide-react";
import { StepProgress, SubdemandStepForm } from "@/components/create-demand";
import type { SubdemandFormData } from "@/components/create-demand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface DemandEditFormProps {
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
    created_by?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function DemandEditForm({ demand, onClose, onSuccess }: DemandEditFormProps) {
  const { user } = useAuth();
  const updateDemand = useUpdateDemand();
  const setAssignees = useSetAssignees();
  const { data: statuses } = useDemandStatuses();
  const { data: boardStatuses } = useBoardStatuses(demand.board_id);
  const { data: currentAssignees } = useDemandAssignees(demand.id);
  const { data: boardRole } = useBoardRole(demand.board_id);
  const { hasBoardServices } = useHasBoardServices(demand.board_id);

  // Recurring demands
  const { data: recurringDemands } = useRecurringDemands(demand.board_id);
  const createRecurring = useCreateRecurringDemand();
  const updateRecurring = useUpdateRecurringDemand();
  const deleteRecurring = useDeleteRecurringDemand();
  const addSubdemand = useAddSubdemand();

  const isBoardManager = boardRole === "admin" || boardRole === "moderator";
  const isCreator = !!user && demand.created_by === user.id;
  const isResponsible = !!user && !!currentAssignees?.some((a) => a.user_id === user.id);
  // Only managers, the creator or a current responsible can manage assignees & recurrence.
  const canManageAssignees = boardRole !== "requester" && (isBoardManager || isCreator || isResponsible);
  const canAssignResponsibles = canManageAssignees;

  // Parent state — pre-populated from demand
  const [title, setTitle] = useState(demand.title);
  const [description, setDescription] = useState(demand.description || "");
  const [statusId, setStatusId] = useState(demand.status_id);
  const [priority, setPriority] = useState(demand.priority || "média");
  const [dueDate, setDueDate] = useState(toDateOnly(demand.due_date) || "");
  const [serviceId, setServiceId] = useState(demand.service_id || "");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [primaryAssignee, setPrimaryAssignee] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceData>(defaultRecurrenceData);
  const [matchedRecurringId, setMatchedRecurringId] = useState<string | null>(null);

  // Subdemand state — only NEW subdemands to be added
  const [newSubdemands, setNewSubdemands] = useState<SubdemandFormData[]>([]);

  // Step state: 0 = parent, 1..N = subdemand forms
  const [currentStep, setCurrentStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);

  const totalSteps = 1 + newSubdemands.length;
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollContentToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Status options
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

  const defaultSubStatusId = useMemo(() => {
    const initial = statusOptions.find((s) => s.name === "A Iniciar");
    return initial?.id || statusOptions[0]?.id || statusId;
  }, [statusOptions, statusId]);

  useEffect(() => {
    if (currentAssignees) {
      setSelectedAssignees(currentAssignees.map((a) => a.user_id));
      const primary = currentAssignees.find((a) => a.is_primary)?.user_id ?? currentAssignees[0]?.user_id ?? null;
      setPrimaryAssignee(primary);
    }
  }, [currentAssignees]);

  // Load existing recurring demand — vincula primeiro por ID (vínculo robusto), depois fallback por título
  useEffect(() => {
    if (recurringDemands && (recurringDemands as any[]).length > 0) {
      const items = recurringDemands as any[];
      const recurringId = (demand as any).recurring_demand_id;
      const match =
        (recurringId && items.find((rd) => rd.id === recurringId)) ||
        items.find((rd) => rd.title === demand.title && rd.board_id === demand.board_id);

      if (match) {
        setMatchedRecurringId(match.id);
        setRecurrence({
          enabled: true,
          frequency: match.frequency as RecurrenceData["frequency"],
          weekdays: match.weekdays || [1, 2, 3, 4, 5],
          dayOfMonth: match.day_of_month || 1,
          startDate: match.start_date || new Date().toISOString().split("T")[0],
          endDate: match.end_date || "",
        });
      }
    }
  }, [recurringDemands, demand.title, demand.board_id, (demand as any).recurring_demand_id]);

  // Draft persistence
  const draftFields = useMemo(
    () => ({ title, description, statusId, priority, dueDate, serviceId, selectedAssignees }),
    [title, description, statusId, priority, dueDate, serviceId, selectedAssignees]
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
    }),
    []
  );

  const { hasContent, clearDraft } = useFormDraft({
    formId: `edit-demand-${demand.id}`,
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

  // Subdemand handlers
  const handleAddSubdemandSlot = () => {
    const newIdx = newSubdemands.length + 1;
    setNewSubdemands((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        title: "",
        priority: "média",
        status_id: defaultSubStatusId,
        service_id: serviceId && serviceId !== "none" ? serviceId : undefined,
        assigneeIds: [],
      },
    ]);
    setTimeout(() => {
      setCurrentStep(newIdx);
      setMaxVisitedStep((prev) => Math.max(prev, newIdx));
      scrollContentToTop();
    }, 0);
  };

  const handleSetSubdemandCount = (count: number) => {
    const clamped = Math.max(0, Math.min(20, count));
    setNewSubdemands((prev) => {
      if (clamped === prev.length) return prev;
      if (clamped > prev.length) {
        const toAdd = clamped - prev.length;
        const additions: SubdemandFormData[] = Array.from({ length: toAdd }, () => ({
          tempId: crypto.randomUUID(),
          title: "",
          priority: "média",
          status_id: defaultSubStatusId,
          service_id: serviceId && serviceId !== "none" ? serviceId : undefined,
          assigneeIds: [],
        }));
        return [...prev, ...additions];
      }
      // shrinking
      const next = prev.slice(0, clamped);
      setCurrentStep((cs) => Math.min(cs, clamped));
      setMaxVisitedStep((mv) => Math.min(mv, clamped));
      return next;
    });
  };

  const handleSubdemandChange = (index: number, data: SubdemandFormData) => {
    setNewSubdemands((prev) => prev.map((s, i) => (i === index ? data : s)));
  };

  const handleRemoveSubdemand = (index: number) => {
    setNewSubdemands((prev) => prev.filter((_, i) => i !== index));
    setCurrentStep((prev) => (prev > index ? prev - 1 : prev));
  };

  // Saved steps tracking (visual)
  const savedSteps = useMemo(() => {
    const set = new Set<number>();
    if (title.trim() && statusId && priority && dueDate) set.add(0);
    newSubdemands.forEach((s, idx) => {
      if (s.title.trim() && s.priority && s.due_date && (s.assigneeIds?.length || 0) > 0) {
        set.add(idx + 1);
      }
    });
    return set;
  }, [title, statusId, priority, dueDate, newSubdemands]);

  const stepTitles = useMemo(() => {
    const map: Record<number, string> = {};
    if (title.trim()) map[0] = title.trim();
    newSubdemands.forEach((s, idx) => {
      if (s.title.trim()) map[idx + 1] = s.title.trim();
    });
    return map;
  }, [title, newSubdemands]);

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setMaxVisitedStep((prev) => Math.max(prev, next));
      scrollContentToTop();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollContentToTop();
    }
  };

  const handleStepClick = (idx: number) => {
    if (idx <= maxVisitedStep) {
      setCurrentStep(idx);
      scrollContentToTop();
    }
  };

  const isParentValid = !!title.trim() && !!statusId && !!priority && !!dueDate && (!canAssignResponsibles || selectedAssignees.length > 0);

  const isOnSubdemandStep = currentStep > 0 && currentStep <= newSubdemands.length;
  const currentSubIndex = isOnSubdemandStep ? currentStep - 1 : -1;

  const canGoNext = () => {
    if (currentStep === 0) return isParentValid;
    if (isOnSubdemandStep) {
      const sub = newSubdemands[currentSubIndex];
      return !!sub?.title.trim() && !!sub?.priority && !!sub?.due_date && (sub?.assigneeIds?.length || 0) > 0;
    }
    return false;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !statusId) return;

    if (!priority) {
      toast.error("Defina a prioridade da demanda");
      setCurrentStep(0);
      return;
    }
    if (!dueDate) {
      toast.error("A data de entrega é obrigatória");
      setCurrentStep(0);
      return;
    }
    if (canAssignResponsibles && selectedAssignees.length === 0) {
      toast.error("Selecione pelo menos um responsável");
      setCurrentStep(0);
      return;
    }

    // Validate subdemands
    const validSubs = newSubdemands.filter((s) => s.title.trim());
    for (let i = 0; i < validSubs.length; i++) {
      const s = validSubs[i];
      const originalIdx = newSubdemands.indexOf(s);
      if (!s.assigneeIds || s.assigneeIds.length === 0) {
        toast.error(`Subdemanda ${i + 1}: selecione pelo menos um responsável`);
        setCurrentStep(originalIdx + 1);
        return;
      }
      if (!s.priority) {
        toast.error(`Subdemanda ${i + 1}: defina a prioridade`);
        setCurrentStep(originalIdx + 1);
        return;
      }
      if (!s.due_date) {
        toast.error(`Subdemanda ${i + 1}: defina a data de entrega`);
        setCurrentStep(originalIdx + 1);
        return;
      }
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

      if (canManageAssignees) {
        await setAssignees.mutateAsync({
          demandId: demand.id,
          userIds: selectedAssignees,
          primaryUserId: primaryAssignee,
        });
      }

      // Add new subdemands
      const parentAssigneeSet = new Set(selectedAssignees);
      for (const sub of validSubs) {
        const created = await addSubdemand.mutateAsync({
          parentDemandId: demand.id,
          title: sub.title.trim(),
          teamId: demand.team_id,
          boardId: demand.board_id,
          statusId: sub.status_id || defaultSubStatusId,
          priority: sub.priority || "média",
          description: sub.description,
          dueDate: sub.due_date,
          serviceId: sub.service_id,
        });
        const sanitized = (sub.assigneeIds || []).filter((id) => parentAssigneeSet.has(id));
        if (created && sanitized.length > 0) {
          await supabase
            .from("demand_assignees")
            .insert(sanitized.map((userId) => ({ demand_id: (created as any).id, user_id: userId })));
        }
      }

      await handleRecurrence();
      clearDraft();

      const subMsg = validSubs.length > 0 ? ` e ${validSubs.length} subdemanda(s) criada(s)` : "";
      toast.success(`Demanda atualizada${subMsg}!`);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao atualizar demanda", {
        description: getErrorMessage(error),
      });
    }
  };

  const handleRecurrence = async () => {
    try {
      if (recurrence.enabled) {
        const recurrencePayload = {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          frequency: recurrence.frequency,
          weekdays: recurrence.frequency === "weekly" || recurrence.frequency === "biweekly" ? recurrence.weekdays : [],
          day_of_month: recurrence.frequency === "monthly" ? recurrence.dayOfMonth : null,
          start_date: recurrence.startDate,
          end_date: recurrence.endDate || null,
        };

        if (matchedRecurringId) {
          await updateRecurring.mutateAsync({ id: matchedRecurringId, ...recurrencePayload });
        } else {
          await createRecurring.mutateAsync({
            team_id: demand.team_id,
            board_id: demand.board_id,
            status_id: statusId,
            service_id: serviceId && serviceId !== "none" ? serviceId : null,
            assignee_ids: selectedAssignees,
            ...recurrencePayload,
          });
        }
      } else if (matchedRecurringId) {
        await deleteRecurring.mutateAsync(matchedRecurringId);
        setMatchedRecurringId(null);
      }
    } catch (recError: any) {
      console.error("Erro ao salvar recorrência:", recError);
      const msg = recError?.message || "Erro desconhecido";
      toast.error(`Demanda atualizada, mas a recorrência falhou: ${msg}`);
    }
  };

  const isSaving =
    updateDemand.isPending ||
    setAssignees.isPending ||
    createRecurring.isPending ||
    updateRecurring.isPending ||
    deleteRecurring.isPending ||
    addSubdemand.isPending;

  // Step title/description (mirrors CreateDemand)
  const getStepTitle = () => {
    if (currentStep === 0) return "Editar Demanda";
    return `Nova Subdemanda ${currentSubIndex + 1} de ${newSubdemands.length}`;
  };

  const getStepDescription = () => {
    if (currentStep === 0) return "Atualize os dados da demanda principal";
    return "Configure os detalhes desta nova subdemanda";
  };

  return (
    <>
      <UnsavedChangesDialog
        open={isBlocked}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        onDontShowAgain={setDontShowAgain}
      />

      <DialogHeader className="shrink-0 px-6 pt-6 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <DialogTitle className="text-xl font-bold">{getStepTitle()}</DialogTitle>
            <p className="text-sm text-muted-foreground">{getStepDescription()}</p>
          </div>
          {canManageAssignees && (
            <div
              className="flex items-center gap-1.5 shrink-0 rounded-md border border-[#F28705]/30 bg-[#F28705]/10 px-2 py-1"
              title={!isParentValid ? "Preencha os campos obrigatórios da demanda" : "Definir quantidade de subdemandas"}
            >
              <GitBranch className="h-3.5 w-3.5 text-[#F28705]" />
              <span className="text-xs font-medium text-[#F28705] hidden sm:inline mr-1">Subdemandas</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[#F28705] hover:bg-[#F28705]/20 hover:text-[#F28705]"
                onClick={() => handleSetSubdemandCount(newSubdemands.length - 1)}
                disabled={newSubdemands.length <= 0 || !isParentValid}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-bold text-[#F28705] min-w-[18px] text-center">
                {newSubdemands.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[#F28705] hover:bg-[#F28705]/20 hover:text-[#F28705]"
                onClick={() => handleSetSubdemandCount(newSubdemands.length + 1)}
                disabled={newSubdemands.length >= 20 || !isParentValid}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        {newSubdemands.length > 0 && (
          <StepProgress
            currentStep={currentStep}
            totalSteps={totalSteps}
            subdemandCount={newSubdemands.length}
            maxVisitedStep={maxVisitedStep}
            onStepClick={handleStepClick}
            stepTitles={stepTitles}
            savedSteps={savedSteps}
          />
        )}
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 pb-4">
          {/* STEP 0 — Parent demand (mirrors CreateDemand layout) */}
          {currentStep === 0 && (
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título *</Label>
                <Input
                  id="edit-title"
                  placeholder="Ex: Implementar nova funcionalidade"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="h-8"
                />
              </div>

              {/* Service + Assignees */}
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

              {/* Status + Priority + Due Date */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status *</Label>
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
                  <Label htmlFor="edit-priority">Prioridade *</Label>
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
                  <Label htmlFor="edit-dueDate">Data de Entrega *</Label>
                  <Input
                    id="edit-dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-8"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Descreva os detalhes da demanda..."
                  minHeight="140px"
                />
              </div>

              {/* Recurrence — only for managers, creator or responsibles */}
              {canManageAssignees && (
                <div className="space-y-2">
                  <Label>Recorrência</Label>
                  <RecurrenceConfig value={recurrence} onChange={setRecurrence} compact />
                </div>
              )}
            </div>
          )}

          {/* SUBDEMAND STEPS */}
          {isOnSubdemandStep && newSubdemands[currentSubIndex] && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 bg-[#F28705]/5 border border-[#F28705]/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-[#F28705]" />
                  <span className="text-sm font-semibold">Nova Subdemanda {currentSubIndex + 1}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSubdemand(currentSubIndex)}
                  className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remover
                </Button>
              </div>
              <SubdemandStepForm
                index={currentSubIndex}
                data={newSubdemands[currentSubIndex]}
                onChange={(d) => handleSubdemandChange(currentSubIndex, d)}
                allSubdemands={newSubdemands}
                statuses={statusOptions}
                defaultStatusId={defaultSubStatusId}
                teamId={demand.team_id}
                boardId={demand.board_id}
                parentServiceId={serviceId && serviceId !== "none" ? serviceId : undefined}
                parentAssigneeIds={selectedAssignees}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-2 flex items-center justify-between bg-card border-t border-border">
          <div>
            {currentStep > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={goPrev} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>

            {/* Show "Próximo" while not on the last step */}
            {currentStep < totalSteps - 1 && (
              <Button
                type="button"
                size="sm"
                disabled={!canGoNext()}
                onClick={goNext}
                className="gap-1"
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {/* Show "Salvar" on the last step */}
            {currentStep === totalSteps - 1 && (
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !isParentValid}
                className="bg-[#F28705] text-white border border-transparent hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : newSubdemands.length > 0 ? (
                  `Salvar + ${newSubdemands.length} subdemanda(s)`
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
