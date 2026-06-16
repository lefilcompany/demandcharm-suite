import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useCreateDemand } from "@/hooks/useDemands";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useCanCreateDemandOnBoard } from "@/hooks/useBoardScope";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useHasBoardServices, useCanCreateWithService } from "@/hooks/useBoardServices";
import { useBoards } from "@/hooks/useBoards";
import { useDemandFolders, useAddDemandToFolder } from "@/hooks/useDemandFolders";
import { ServiceSelector } from "@/components/ServiceSelector";
import { AssigneeSelector } from "@/components/AssigneeSelector";
import { ApprovalNotificationsModal } from "@/components/ApprovalNotificationsModal";
import { ScopeProgressBar } from "@/components/ScopeProgressBar";
import { InlineFileUploader, PendingFile, uploadPendingFiles } from "@/components/InlineFileUploader";
import { useUploadAttachment } from "@/hooks/useAttachments";
import { RecurrenceConfig, RecurrenceData, defaultRecurrenceData } from "@/components/RecurrenceConfig";
import { useCreateRecurringDemand } from "@/hooks/useRecurringDemands";
import { useCreateDemandWithSubdemands, SubdemandInput, DependencyInput } from "@/hooks/useSubdemands";
import { AlertTriangle, Ban, WifiOff, Package, CheckCircle2, Plus, ExternalLink, LayoutGrid, FolderOpen, Users, ChevronLeft, ChevronRight, Loader2, Search, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { SEOHead } from "@/components/SEOHead";
import { calculateBusinessDueDate, formatDueDateForInput } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  StepProgress,
  SubdemandCountStep,
  SubdemandStepForm,
  ReviewStep,
} from "@/components/create-demand";
import type { SubdemandFormData } from "@/components/create-demand";

export default function CreateDemand({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOpen: contextOpen, initialDueDate, closeCreateDemand } = useCreateDemandModal();

  const isOpen = open ?? contextOpen;
  const handleClose = () => {
    onClose?.();
    closeCreateDemand();
    setSuccessState(null);
    setCurrentStep(0);
  };

  const { isOffline } = useOfflineStatus();
  const createDemand = useCreateDemand();
  const addDemandToFolder = useAddDemandToFolder();
  const { selectedTeamId, teams } = useSelectedTeam();
  const { selectedBoardId, setSelectedBoardId, boards: contextBoards } = useSelectedBoardSafe();
  const { data: allBoards } = useBoards(selectedTeamId);
  const { data: allFolders } = useDemandFolders(selectedTeamId, user?.id);

  const [formBoardId, setFormBoardId] = useState<string>("");
  const [boardSearch, setBoardSearch] = useState<string>("");
  const [boardPopoverOpen, setBoardPopoverOpen] = useState(false);
  const filteredBoards = useMemo(() => {
    if (!allBoards) return [];
    const q = boardSearch.trim().toLowerCase();
    if (!q) return allBoards;
    return allBoards.filter((b) => b.name.toLowerCase().includes(q));
  }, [allBoards, boardSearch]);
  const { data: boardStatuses } = useBoardStatuses(formBoardId || null);

  const statuses = useMemo(() => {
    if (!boardStatuses) return [];
    return boardStatuses.map(bs => ({
      id: bs.status.id,
      name: bs.status.name,
      color: bs.status.color,
    }));
  }, [boardStatuses]);

  const [successState, setSuccessState] = useState<{
    demandId: string;
    demandTitle: string;
    boardId: string;
    boardName: string;
  } | null>(null);

  const activeBoardId = formBoardId || selectedBoardId;

  const {
    canCreate,
    isTeamActive,
    isWithinLimit,
    hasBoardLimit,
    monthlyCount,
    limit
  } = useCanCreateDemandOnBoard(activeBoardId, selectedTeamId);
  const { data: role } = useTeamRole(selectedTeamId);
  const { data: boardRole } = useBoardRole(activeBoardId);
  const { hasBoardServices } = useHasBoardServices(activeBoardId);

  const canAssignResponsibles = boardRole !== "requester";

  // Parent form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState("");
  const [priority, setPriority] = useState("média");
  const [dueDate, setDueDate] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceData>(defaultRecurrenceData);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [internalApprovalRecipients, setInternalApprovalRecipients] = useState<string[]>([]);
  const [externalApprovalRecipients, setExternalApprovalRecipients] = useState<string[]>([]);

  // Subdemand state
  const [subdemandCount, setSubdemandCount] = useState(0);
  const [subdemands, setSubdemands] = useState<SubdemandFormData[]>([]);

  // Step state: 0 = parent, 1..N = subdemand config, N+1 = review
  const [currentStep, setCurrentStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);

  const totalSteps = 1 + subdemandCount + (subdemandCount > 0 ? 1 : 0); // parent + subs + review (only if subs > 0)

  const uploadAttachment = useUploadAttachment();
  const createRecurringDemand = useCreateRecurringDemand();
  const createDemandWithSubdemands = useCreateDemandWithSubdemands();

  const { canCreate: canCreateWithService, serviceInfo } = useCanCreateWithService(
    activeBoardId,
    serviceId && serviceId !== "none" ? serviceId : null
  );

  const editableFolders = useMemo(() => {
    if (!allFolders || !user?.id) return [];
    return allFolders.filter((f) => {
      if (f.is_owner) return true;
      const share = f.shared_with?.find((s) => s.user_id === user.id);
      return share?.permission === "edit";
    });
  }, [allFolders, user?.id]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      setSuccessState(null);
      setCurrentStep(0);
      if (initialDueDate) {
        setDueDate(formatDueDateForInput(initialDueDate));
      }
    }
  }, [isOpen]);

  // Sync form board with currently selected board whenever the modal opens
  // or when the user changes the active board while the modal is open.
  useEffect(() => {
    if (isOpen && selectedBoardId) {
      setFormBoardId(selectedBoardId);
    }
  }, [isOpen, selectedBoardId]);

  useEffect(() => {
    if (statuses && statuses.length > 0 && !statusId) {
      const defaultStatus = statuses.find(s => s.name === "A Iniciar") || statuses[0];
      setStatusId(defaultStatus.id);
    }
  }, [statuses, statusId]);

  const handleServiceChange = (newServiceId: string, estimatedHours?: number) => {
    setServiceId(newServiceId);
    if (newServiceId !== "none" && estimatedHours) {
      const calculatedDate = calculateBusinessDueDate(estimatedHours);
      setDueDate(formatDueDateForInput(calculatedDate));
    }
  };

  useEffect(() => {
    if (boardRole === "requester" && isOpen) {
      onClose?.();
      closeCreateDemand();
    }
  }, [boardRole, isOpen, onClose, closeCreateDemand]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatusId("");
    setPriority("média");
    setDueDate("");
    setServiceId("");
    setAssigneeIds([]);
    setPendingFiles([]);
    setRecurrence(defaultRecurrenceData);
    setSelectedFolderId("");
    setInternalApprovalRecipients([]);
    setExternalApprovalRecipients([]);
    setSubdemandCount(0);
    setSubdemands([]);
    setCurrentStep(0);
    setMaxVisitedStep(0);
  };

  const isServiceValid = () => {
    if (!serviceId || serviceId === "none") return false;
    if (canCreateWithService === false) return false;
    return true;
  };

  // Sync subdemands array with count
  useEffect(() => {
    setSubdemands(prev => {
      if (prev.length === subdemandCount) return prev;
      if (prev.length < subdemandCount) {
        const newOnes: SubdemandFormData[] = [];
        for (let i = prev.length; i < subdemandCount; i++) {
          newOnes.push({
            tempId: crypto.randomUUID(),
            title: "",
            priority: "média",
            status_id: statusId,
            service_id: serviceId && serviceId !== "none" ? serviceId : undefined,
          });
        }
        return [...prev, ...newOnes];
      }
      // Shrink: also fix dependency references
      const trimmed = prev.slice(0, subdemandCount);
      return trimmed.map(s => ({
        ...s,
        dependsOnIndex: s.dependsOnIndex !== undefined && s.dependsOnIndex >= subdemandCount ? undefined : s.dependsOnIndex,
      }));
    });
  }, [subdemandCount]);

  const handleSubdemandChange = (index: number, data: SubdemandFormData) => {
    setSubdemands(prev => prev.map((s, i) => i === index ? data : s));
  };

  const persistApprovalRecipients = async (demandId: string) => {
    const rows: { demand_id: string; approval_type: "internal" | "external"; mode: "all" | "manual"; recipient_ids: string[]; include_creator: boolean; created_by: string | null; updated_by: string | null }[] = [];
    if (internalApprovalRecipients.length > 0) {
      rows.push({
        demand_id: demandId,
        approval_type: "internal",
        mode: "manual",
        recipient_ids: internalApprovalRecipients,
        include_creator: true,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
    }
    if (externalApprovalRecipients.length > 0) {
      rows.push({
        demand_id: demandId,
        approval_type: "external",
        mode: "manual",
        recipient_ids: externalApprovalRecipients,
        include_creator: true,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
    }
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("demand_approval_notify_settings" as any)
      .insert(rows);
    if (error) console.error("Error saving approval recipients:", error);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !selectedTeamId || !activeBoardId || !statusId || !canCreate) return;

    if (hasBoardServices && (!serviceId || serviceId === "none")) {
      toast.error("Selecione um serviço para esta demanda");
      return;
    }

    if (canCreateWithService === false) {
      toast.error("Limite mensal deste serviço foi atingido");
      return;
    }

    // Required fields: assignees, priority, due date
    if (canAssignResponsibles && assigneeIds.length === 0) {
      toast.error("Selecione pelo menos um responsável para a demanda");
      return;
    }
    if (!priority) {
      toast.error("Defina a prioridade da demanda");
      return;
    }
    if (!dueDate) {
      toast.error("Defina a data de entrega da demanda");
      return;
    }

    // Validate subdemand required fields
    const validSubdemandsCheck = subdemands.filter(s => s.title.trim());
    for (let i = 0; i < validSubdemandsCheck.length; i++) {
      const s = validSubdemandsCheck[i];
      if (!s.assigneeIds || s.assigneeIds.length === 0) {
        toast.error(`Subdemanda ${i + 1}: selecione pelo menos um responsável`);
        return;
      }
      if (!s.priority) {
        toast.error(`Subdemanda ${i + 1}: defina a prioridade`);
        return;
      }
      if (!s.due_date) {
        toast.error(`Subdemanda ${i + 1}: defina a data de entrega`);
        return;
      }
    }

    let finalDescription = description.trim() || undefined;
    if (finalDescription && finalDescription.includes('data:image')) {
      try {
        const { uploadInlineImages } = await import("@/lib/imageUploadUtils");
        finalDescription = await uploadInlineImages(finalDescription);
      } catch (err) {
        console.error("Error uploading inline images in description:", err);
        finalDescription = finalDescription.replace(/<img\s+[^>]*src="data:[^"]*"[^>]*\/?>/g, '[imagem não enviada]');
      }
    }

    const selectedBoard = allBoards?.find(b => b.id === activeBoardId);
    const validSubdemands = subdemands.filter(s => s.title.trim());

    // If there are subdemands, use transactional RPC
    if (validSubdemands.length > 0) {
      const parentData = {
        title: title.trim(),
        description: finalDescription,
        team_id: selectedTeamId,
        board_id: activeBoardId,
        status_id: statusId,
        priority,
        due_date: dueDate || undefined,
        service_id: serviceId && serviceId !== "none" ? serviceId : undefined,
      };

      // Filter sub assignees to only include those also selected on the parent
      const parentAssigneeSet = new Set(assigneeIds);
      const sanitizedSubdemands = validSubdemands.map((s) => ({
        ...s,
        assigneeIds: (s.assigneeIds || []).filter((id) => parentAssigneeSet.has(id)),
      }));

      const subInputs: SubdemandInput[] = sanitizedSubdemands.map(s => ({
        title: s.title,
        description: s.description || undefined,
        priority: s.priority || "média",
        status_id: s.status_id || statusId,
        service_id: s.service_id || (serviceId && serviceId !== "none" ? serviceId : undefined),
        // Do not set assigned_to here — assignees are managed exclusively via demand_assignees
        assigned_to: undefined,
        due_date: s.due_date || undefined,
      }));

      const deps: DependencyInput[] = sanitizedSubdemands
        .map((s, idx) => {
          if (s.dependsOnIndex !== undefined && s.dependsOnIndex >= 0) {
            return { demand_index: idx + 1, depends_on_index: s.dependsOnIndex + 1 };
          }
          return null;
        })
        .filter(Boolean) as DependencyInput[];

      createDemandWithSubdemands.mutate(
        { parent: parentData, subdemands: subInputs, dependencies: deps },
        {
          onSuccess: async (result) => {
            const parentId = result.parent_id;

            if (assigneeIds.length > 0 && parentId) {
              const primary = primaryAssigneeId && assigneeIds.includes(primaryAssigneeId) ? primaryAssigneeId : assigneeIds[0];
              await supabase
                .from("demand_assignees")
                .insert(assigneeIds.map((userId) => ({ demand_id: parentId, user_id: userId, is_primary: userId === primary })));
            }

            if (result.subdemand_ids && result.subdemand_ids.length > 0) {
              const subAssigneeInserts: { demand_id: string; user_id: string; is_primary: boolean }[] = [];
              sanitizedSubdemands.forEach((sub, idx) => {
                const subId = result.subdemand_ids[idx];
                if (subId && sub.assigneeIds && sub.assigneeIds.length > 0) {
                  const uniqueIds = Array.from(new Set(sub.assigneeIds));
                  const subPrimary = (sub as any).primaryAssigneeId && uniqueIds.includes((sub as any).primaryAssigneeId)
                    ? (sub as any).primaryAssigneeId
                    : uniqueIds[0];
                  uniqueIds.forEach((userId) => {
                    subAssigneeInserts.push({ demand_id: subId, user_id: userId, is_primary: userId === subPrimary });
                  });
                }
              });
              if (subAssigneeInserts.length > 0) {
                await supabase.from("demand_assignees").insert(subAssigneeInserts);
              }

              // Upload subdemand attachments
              for (let idx = 0; idx < validSubdemands.length; idx++) {
                const sub = validSubdemands[idx];
                const subId = result.subdemand_ids[idx];
                if (subId && sub.pendingFiles && sub.pendingFiles.length > 0) {
                  const { success, failed } = await uploadPendingFiles(subId, sub.pendingFiles, uploadAttachment);
                  if (failed > 0) toast.warning(`Subdemanda ${idx + 1}: ${success} arquivo(s) enviado(s), ${failed} falhou(ram)`);
                }
              }
            }

            if (pendingFiles.length > 0 && parentId) {
              const { success, failed } = await uploadPendingFiles(parentId, pendingFiles, uploadAttachment);
              if (failed > 0) toast.warning(`${success} arquivo(s) enviado(s), ${failed} falhou(ram)`);
              else if (success > 0) toast.success(`${success} arquivo(s) anexado(s)`);
              setPendingFiles([]);
            }

            if (selectedFolderId && parentId) {
              try {
                await addDemandToFolder.mutateAsync({ folder_id: selectedFolderId, demand_id: parentId });
              } catch {}
            }

            if (parentId) {
              await persistApprovalRecipients(parentId);
            }

            setSuccessState({
              demandId: parentId,
              demandTitle: title.trim(),
              boardId: activeBoardId,
              boardName: selectedBoard?.name || "Quadro",
            });
            resetForm();
            if (statuses && statuses.length > 0) {
              const defaultStatus = statuses.find(s => s.name === "A Iniciar") || statuses[0];
              setStatusId(defaultStatus.id);
            }
          },
          onError: (error: any) => {
            toast.error("Erro ao criar demanda", {
              description: getErrorMessage(error),
            });
          },
        }
      );
      return;
    }

    // No subdemands — original flow
    createDemand.mutate(
      {
        title: title.trim(),
        description: finalDescription,
        team_id: selectedTeamId,
        board_id: activeBoardId,
        status_id: statusId,
        priority,
        due_date: dueDate || undefined,
        service_id: serviceId && serviceId !== "none" ? serviceId : undefined,
      },
      {
        onSuccess: async (demand) => {
          const wasCreatedOffline = (demand as any)?._isOffline;

          if (!wasCreatedOffline && assigneeIds.length > 0 && demand) {
            const primary = primaryAssigneeId && assigneeIds.includes(primaryAssigneeId) ? primaryAssigneeId : assigneeIds[0];
            const { error: assignError } = await supabase
              .from("demand_assignees")
              .insert(
                assigneeIds.map((userId) => ({
                  demand_id: demand.id,
                  user_id: userId,
                  is_primary: userId === primary,
                }))
              );
            if (assignError) {
              console.error("Erro ao atribuir responsáveis:", assignError);
              toast.warning("Demanda criada, mas houve um erro ao atribuir responsáveis");
            }
          }

          if (!wasCreatedOffline && pendingFiles.length > 0 && demand) {
            const { success, failed } = await uploadPendingFiles(demand.id, pendingFiles, uploadAttachment);
            if (failed > 0) {
              toast.warning(`${success} arquivo(s) enviado(s), ${failed} falhou(ram)`);
            } else if (success > 0) {
              toast.success(`${success} arquivo(s) anexado(s)`);
            }
            setPendingFiles([]);
          }

          if (!wasCreatedOffline && recurrence.enabled && demand && selectedTeamId && activeBoardId) {
            try {
              const createdRecurring = await createRecurringDemand.mutateAsync({
                team_id: selectedTeamId,
                board_id: activeBoardId,
                title: title.trim(),
                description: description.trim() || null,
                priority,
                status_id: statusId,
                service_id: serviceId && serviceId !== "none" ? serviceId : null,
                assignee_ids: assigneeIds,
                frequency: recurrence.frequency,
                weekdays: (recurrence.frequency === "weekly" || recurrence.frequency === "biweekly") ? recurrence.weekdays : [],
                day_of_month: recurrence.frequency === "monthly" ? recurrence.dayOfMonth : null,
                start_date: recurrence.startDate,
                end_date: recurrence.endDate || null,
              });

              // Vincula a demanda recém-criada à regra de recorrência (vínculo persistente por ID)
              if (createdRecurring?.id && demand?.id) {
                await supabase
                  .from("demands")
                  .update({ recurring_demand_id: createdRecurring.id })
                  .eq("id", demand.id);
              }
            } catch (recError: any) {
              console.error("Erro ao criar recorrência:", recError);
              const msg = recError?.message || "Erro desconhecido";
              toast.error(`Demanda criada, mas a recorrência falhou: ${msg}`);
            }
          }

          if (!wasCreatedOffline && selectedFolderId && demand) {
            try {
              await addDemandToFolder.mutateAsync({ folder_id: selectedFolderId, demand_id: demand.id });
            } catch (folderError) {
              console.error("Erro ao adicionar à pasta:", folderError);
              toast.warning("Demanda criada, mas houve um erro ao adicionar à pasta");
            }
          }

          if (!wasCreatedOffline && demand?.id) {
            await persistApprovalRecipients(demand.id);
          }

          setSuccessState({
            demandId: demand?.id || "",
            demandTitle: title.trim(),
            boardId: activeBoardId,
            boardName: selectedBoard?.name || "Quadro",
          });

          resetForm();
          if (statuses && statuses.length > 0) {
            const defaultStatus = statuses.find(s => s.name === "A Iniciar") || statuses[0];
            setStatusId(defaultStatus.id);
          }
        },
        onError: (error: any) => {
          toast.error("Erro ao criar demanda", {
            description: getErrorMessage(error),
          });
        },
      }
    );
  };

  const handleCreateAnother = () => {
    setSuccessState(null);
    setCurrentStep(0);
  };

  const handleGoToBoard = () => {
    if (successState) {
      setSelectedBoardId(successState.boardId);
      handleClose();
      navigate("/demands");
    }
  };

  // Navigation
  const canGoNext = () => {
    if (currentStep === 0) {
      // Parent step — require minimum fields + assignees + priority + due date
      const baseValid = !!(title.trim() && statusId && activeBoardId && canCreate !== false && (hasBoardServices ? isServiceValid() : true));
      const assigneesValid = canAssignResponsibles ? assigneeIds.length > 0 : true;
      return baseValid && assigneesValid && !!priority && !!dueDate;
    }
    if (currentStep > 0 && currentStep <= subdemandCount) {
      // Subdemand step — require title + assignees + priority + due date
      const subIdx = currentStep - 1;
      const sub = subdemands[subIdx];
      if (!sub?.title?.trim()) return false;
      if (!sub.assigneeIds || sub.assigneeIds.length === 0) return false;
      if (!sub.priority) return false;
      if (!sub.due_date) return false;
      return true;
    }
    return true;
  };

  const contentRef = useRef<HTMLDivElement>(null);

  const scrollContentToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setMaxVisitedStep(prev => Math.max(prev, nextStep));
      scrollContentToTop();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollContentToTop();
    }
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= maxVisitedStep) {
      setCurrentStep(stepIndex);
      scrollContentToTop();
    }
  };

  // When count changes, if we're beyond the new total, reset to step 0
  useEffect(() => {
    if (currentStep > 0 && currentStep >= totalSteps) {
      setCurrentStep(0);
    }
  }, [totalSteps]);

  const isParentStep = currentStep === 0;
  const isReviewStep = subdemandCount > 0 && currentStep === totalSteps - 1;
  const subdemandStepIndex = !isParentStep && !isReviewStep ? currentStep - 1 : -1;

  const isSubmitting = createDemand.isPending || createDemandWithSubdemands.isPending;

  const parentFormValid = !!(
    title.trim() && statusId && activeBoardId && canCreate !== false &&
    (hasBoardServices ? isServiceValid() : true) &&
    (canAssignResponsibles ? assigneeIds.length > 0 : true) &&
    !!priority && !!dueDate
  );

  // Step title
  const getStepTitle = () => {
    if (isParentStep) return "Nova Demanda";
    if (isReviewStep) return "Revisão Final";
    return `Subdemanda ${subdemandStepIndex + 1} de ${subdemandCount}`;
  };

  const getStepDescription = () => {
    if (isParentStep) return "Selecione o quadro e preencha os dados da demanda";
    if (isReviewStep) return "Revise os dados antes de criar tudo";
    return "Configure os detalhes desta subdemanda";
  };

  const selectedBoard = allBoards?.find(b => b.id === activeBoardId);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SEOHead title="Nova Demanda" />
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0">
        {successState ? (
          <>
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-6">
              <div className="rounded-full bg-success/10 p-4">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Demanda criada com sucesso!</h2>
                <p className="text-muted-foreground max-w-md">
                  A demanda <span className="font-medium text-foreground">"{successState.demandTitle}"</span> foi criada no quadro{" "}
                  <span className="font-medium text-primary">{successState.boardName}</span>.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
                <Button variant="outline" className="flex-1 gap-2" onClick={handleCreateAnother}>
                  <Plus className="h-4 w-4" />
                  Criar Nova
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (successState?.demandId) {
                      handleClose();
                      navigate(`/demands/${successState.demandId}`);
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir para a Demanda
                </Button>
                <Button className="flex-1 gap-2" onClick={handleGoToBoard}>
                  <LayoutGrid className="h-4 w-4" />
                  Ir para o Quadro
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0 space-y-3">
              <DialogTitle className="text-xl font-bold">{getStepTitle()}</DialogTitle>
              <p className="text-sm text-muted-foreground">{getStepDescription()}</p>
              {subdemandCount > 0 && (
                <StepProgress
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                  subdemandCount={subdemandCount}
                  maxVisitedStep={maxVisitedStep}
                  onStepClick={handleStepClick}
                  stepTitles={{
                    0: title || "",
                    ...Object.fromEntries(
                      subdemands.map((s, i) => [i + 1, s.title || ""])
                    ),
                  }}
                  savedSteps={new Set([
                    ...(title?.trim() ? [0] : []),
                    ...subdemands
                      .map((s, i) => (s.title?.trim() ? i + 1 : -1))
                      .filter((i) => i >= 0),
                  ])}
                />
              )}
            </DialogHeader>

            <div ref={contentRef} className="flex-1 overflow-y-auto px-2 pb-6">
              {/* ── STEP 0: Parent Demand ── */}
              {isParentStep && (
                <>
                  {/* Alerts */}
                  <div className="space-y-3 mb-4">
                    {isOffline && (
                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <WifiOff className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 dark:text-amber-400">
                          Você está offline. A demanda será salva localmente e sincronizada quando a conexão for restaurada.
                        </AlertDescription>
                      </Alert>
                    )}
                    {!isTeamActive && (
                      <Alert variant="destructive">
                        <Ban className="h-4 w-4" />
                        <AlertDescription>
                          O contrato desta equipe está inativo. Não é possível criar novas demandas.
                        </AlertDescription>
                      </Alert>
                    )}
                    {hasBoardLimit && isTeamActive && (
                      <div className="rounded-lg border border-border bg-card p-3">
                        <ScopeProgressBar used={monthlyCount} limit={limit} />
                      </div>
                    )}
                    {!isWithinLimit && isTeamActive && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          O limite mensal de demandas deste quadro foi atingido.
                        </AlertDescription>
                      </Alert>
                    )}
                    {canCreateWithService === false && serviceInfo && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Limite mensal para o serviço selecionado atingido ({serviceInfo.currentCount}/{serviceInfo.monthly_limit}).
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Board Selector */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Quadro *
                      </Label>
                      <Popover open={boardPopoverOpen} onOpenChange={(o) => { setBoardPopoverOpen(o); if (!o) setBoardSearch(""); }}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={boardPopoverOpen}
                            className="h-8 w-full justify-between font-normal bg-white hover:bg-white hover:text-[#F28705] hover:border-[#F28705] transition-colors"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">
                                {allBoards?.find((b) => b.id === formBoardId)?.name || "Selecione o quadro"}
                              </span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 opacity-50 rotate-90" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                              <Input
                                value={boardSearch}
                                onChange={(e) => setBoardSearch(e.target.value)}
                                placeholder="Buscar quadro..."
                                className="h-8 pl-7 focus-visible:ring-0 focus-visible:ring-offset-0"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div
                            className="max-h-60 overflow-y-auto overscroll-contain p-1"
                            onWheel={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                          >
                            {filteredBoards.length === 0 ? (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Nenhum quadro encontrado
                              </div>
                            ) : (
                              filteredBoards.map((board) => (
                                <button
                                  key={board.id}
                                  type="button"
                                  onClick={() => {
                                    setFormBoardId(board.id);
                                    setServiceId("");
                                    setAssigneeIds([]);
                                    setStatusId("");
                                    setBoardPopoverOpen(false);
                                    setBoardSearch("");
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm border border-transparent bg-white hover:bg-white hover:text-[#F28705] hover:border-[#F28705] transition-colors text-left"
                                >
                                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate flex-1">{board.name}</span>
                                  {formBoardId === board.id && (
                                    <Check className="h-4 w-4 text-[#F28705] shrink-0" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        placeholder="Ex: Implementar nova funcionalidade"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        autoFocus
                        disabled={!formBoardId}
                        className="h-8"
                      />
                    </div>

                    {/* Service + Assignees + Folder */}
                    <div className={`grid gap-4 grid-cols-1 ${editableFolders.length > 0 && canAssignResponsibles ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Serviço {hasBoardServices ? "*" : ""}
                        </Label>
                        <ServiceSelector
                          teamId={selectedTeamId}
                          boardId={activeBoardId}
                          value={serviceId}
                          onChange={handleServiceChange}
                          userRole={boardRole}
                        />
                        <p className="text-xs text-muted-foreground">
                          {hasBoardServices
                            ? "Serviço obrigatório para esta demanda"
                            : "Selecione para calcular data de entrega"
                          }
                        </p>
                      </div>

                      {canAssignResponsibles && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Responsável e acompanhantes *
                          </Label>
                          <AssigneeSelector
                            teamId={selectedTeamId}
                            boardId={activeBoardId}
                            selectedUserIds={assigneeIds}
                            onChange={setAssigneeIds}
                            primaryUserId={primaryAssigneeId}
                            onPrimaryChange={setPrimaryAssigneeId}
                            hideIcon
                          />
                        </div>
                      )}

                      {editableFolders.length > 0 && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            Pasta
                          </Label>
                          <Select value={selectedFolderId || ""} onValueChange={(v) => setSelectedFolderId(v === "none" ? "" : v)}>
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Selecione uma pasta" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma pasta</SelectItem>
                              {editableFolders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  <div className="flex items-center gap-2">
                                    <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color }} />
                                    <span className="truncate">{folder.name}</span>
                                    {!folder.is_owner && (
                                      <span className="text-[10px] text-muted-foreground ml-1">(compartilhada)</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Status + Priority + Due Date */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status *</Label>
                        <Select value={statusId} onValueChange={setStatusId} required disabled={!formBoardId}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder={!formBoardId ? "Selecione o quadro primeiro" : "Selecione"} />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses?.map((status) => (
                              <SelectItem key={status.id} value={status.id}>
                                {status.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority">Prioridade *</Label>
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
                        <Label htmlFor="dueDate">Data de Entrega *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="h-8"
                          required
                        />
                      </div>
                    </div>

                    {/* Subdemand counter + Approval notifications side-by-side */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <SubdemandCountStep count={subdemandCount} onChange={setSubdemandCount} />
                      {activeBoardId && (
                        <ApprovalNotificationsModal
                          boardId={activeBoardId}
                          internalIds={internalApprovalRecipients}
                          externalIds={externalApprovalRecipients}
                          onChangeInternal={setInternalApprovalRecipients}
                          onChangeExternal={setExternalApprovalRecipients}
                        />
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="Descreva os detalhes da demanda... (cole imagens diretamente)"
                        minHeight="120px"
                      />
                    </div>

                    {/* Attachments + Recurrence */}
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Anexos</Label>
                          {pendingFiles.length > 0 && (
                            <span className="text-xs text-muted-foreground">{pendingFiles.length} arquivo(s)</span>
                          )}
                        </div>
                        <InlineFileUploader
                          pendingFiles={pendingFiles}
                          onFilesChange={setPendingFiles}
                          disabled={isOffline}
                          listenToGlobalPaste={!isOffline}
                        />
                        {isOffline && (
                          <p className="text-xs text-muted-foreground">
                            Anexos não podem ser adicionados offline
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Recorrência</Label>
                        <RecurrenceConfig value={recurrence} onChange={setRecurrence} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── SUBDEMAND STEPS ── */}
              {subdemandStepIndex >= 0 && subdemandStepIndex < subdemands.length && (
                <SubdemandStepForm
                  index={subdemandStepIndex}
                  data={subdemands[subdemandStepIndex]}
                  onChange={(data) => handleSubdemandChange(subdemandStepIndex, data)}
                  allSubdemands={subdemands}
                  statuses={statuses}
                  defaultStatusId={statusId}
                  teamId={selectedTeamId}
                  boardId={activeBoardId}
                  parentServiceId={serviceId && serviceId !== "none" ? serviceId : undefined}
                  parentAssigneeIds={assigneeIds}
                />
              )}

              {/* ── REVIEW STEP ── */}
              {isReviewStep && (
                <ReviewStep
                  parentTitle={title}
                  parentPriority={priority}
                  parentStatusId={statusId}
                  parentDueDate={dueDate}
                  parentBoardName={selectedBoard?.name || "Quadro"}
                  subdemands={subdemands}
                  statuses={statuses}
                />
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-2 flex items-center justify-between bg-card border-t border-border">
              <div>
                {currentStep > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={handlePrev} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                  Cancelar
                </Button>

                {/* If no subdemands, show create button on step 0 */}
                {isParentStep && subdemandCount === 0 && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!parentFormValid || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : "Criar Demanda"}
                  </Button>
                )}

                {/* If has subdemands and not on review, show Next */}
                {subdemandCount > 0 && !isReviewStep && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canGoNext()}
                    onClick={handleNext}
                    className="gap-1"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}

                {/* Review step: create all */}
                {isReviewStep && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : "Criar Tudo"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
