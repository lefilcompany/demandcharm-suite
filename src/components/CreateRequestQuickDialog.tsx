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
import { useUploadRequestAttachment } from "@/hooks/useRequestAttachments";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardServices } from "@/hooks/useBoardServices";
import { useFormDraft } from "@/hooks/useFormDraft";
import { logBlockedSubmit } from "@/lib/submitBlockAudit";
import { toast } from "sonner";
import { Calendar, Loader2, Send, ArrowLeft, ArrowRight } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";
import { InlineFileUploader, PendingFile } from "@/components/InlineFileUploader";
import { StepProgress, SubdemandCountStep } from "@/components/create-demand";
import {
  RequestSubdemandStepForm,
  RequestSubdemandFormData,
} from "@/components/request-wizard/RequestSubdemandStepForm";
import { RequestReviewStep } from "@/components/request-wizard/RequestReviewStep";

interface CreateRequestQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
}

const makeTempId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function CreateRequestQuickDialog({
  open,
  onOpenChange,
  selectedDate,
}: CreateRequestQuickDialogProps) {
  const navigate = useNavigate();
  const { selectedBoardId, currentTeamId, currentBoard } = useSelectedBoard();
  const { data: boardServices } = useBoardServices(selectedBoardId || undefined);
  const createRequest = useCreateDemandRequest();
  const uploadAttachment = useUploadRequestAttachment();

  // Parent request state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("média");
  const [serviceId, setServiceId] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Wizard state
  const [subdemands, setSubdemands] = useState<RequestSubdemandFormData[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const subdemandCount = subdemands.length;
  const totalSteps = 1 + subdemandCount + 1; // parent + subs + review
  const reviewStepIndex = totalSteps - 1;

  const setSubdemandCount = (count: number) => {
    setSubdemands((prev) => {
      if (count === prev.length) return prev;
      if (count > prev.length) {
        const extra = Array.from({ length: count - prev.length }, () => ({
          tempId: makeTempId(),
          title: "",
          priority: "média",
        })) as RequestSubdemandFormData[];
        return [...prev, ...extra];
      }
      return prev.slice(0, count);
    });
  };

  // Draft persistence (excludes File objects, which aren't serializable)
  const draftableSubs = useMemo(
    () =>
      subdemands.map((s) => ({
        tempId: s.tempId,
        title: s.title,
        description: s.description,
        priority: s.priority,
        service_id: s.service_id,
        due_date: s.due_date,
        dependsOnIndex: s.dependsOnIndex,
      })),
    [subdemands]
  );

  const draftFields = useMemo(
    () => ({
      title,
      description,
      priority,
      serviceId,
      subdemands: draftableSubs,
    }),
    [title, description, priority, serviceId, draftableSubs]
  );

  const draftSetters = useMemo(
    () => ({
      title: setTitle,
      description: setDescription,
      priority: setPriority,
      serviceId: setServiceId,
      subdemands: (value: any) => {
        if (Array.isArray(value)) {
          setSubdemands(
            value.map((v: any) => ({
              tempId: v.tempId || makeTempId(),
              title: v.title || "",
              description: v.description,
              priority: v.priority || "média",
              service_id: v.service_id,
              due_date: v.due_date,
              dependsOnIndex: v.dependsOnIndex,
            }))
          );
        }
      },
    }),
    []
  );

  const { clearDraft } = useFormDraft({
    formId: `quick-request-${selectedBoardId || "default"}`,
    fields: draftFields,
    setters: draftSetters,
  });

  // Savings tracking for progress bar
  const savedSteps = useMemo(() => {
    const set = new Set<number>();
    if (title.trim() && serviceId && serviceId !== "none") set.add(0);
    subdemands.forEach((s, i) => {
      if (s.title.trim() && s.service_id) set.add(i + 1);
    });
    return set;
  }, [title, serviceId, subdemands]);

  const stepTitles = useMemo(() => {
    const map: Record<number, string> = {};
    if (title.trim()) map[0] = title.trim();
    subdemands.forEach((s, i) => {
      if (s.title.trim()) map[i + 1] = s.title.trim();
    });
    return map;
  }, [title, subdemands]);

  const validateParent = (): string[] => {
    const failed: string[] = [];
    if (!title.trim()) failed.push("title_empty");
    if (!description.trim()) failed.push("description_empty");
    if (!serviceId || serviceId === "none") failed.push("service_missing");
    if (!selectedBoardId) failed.push("board_missing");
    if (!currentTeamId) failed.push("team_missing");
    return failed;
  };

  const validateSub = (sub: RequestSubdemandFormData): string[] => {
    const failed: string[] = [];
    if (!sub.title.trim()) failed.push("title_empty");
    if (!sub.service_id) failed.push("service_missing");
    return failed;
  };

  const goNext = () => {
    if (currentStep === 0) {
      const failed = validateParent();
      if (failed.length > 0) {
        if (failed.includes("title_empty")) toast.error("O título é obrigatório");
        else if (failed.includes("description_empty")) toast.error("A descrição é obrigatória");
        else if (failed.includes("service_missing")) toast.error("Selecione um serviço");
        else toast.error("Selecione um quadro primeiro");
        return;
      }
    } else if (currentStep > 0 && currentStep < reviewStepIndex) {
      const sub = subdemands[currentStep - 1];
      const failed = validateSub(sub);
      if (failed.length > 0) {
        toast.error(
          failed.includes("title_empty")
            ? `Informe o título da Subdemanda ${currentStep}`
            : `Selecione o serviço da Subdemanda ${currentStep}`
        );
        return;
      }
    }
    const next = Math.min(reviewStepIndex, currentStep + 1);
    setCurrentStep(next);
    setMaxVisitedStep((m) => Math.max(m, next));
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const jumpTo = (idx: number) => {
    if (idx <= maxVisitedStep) setCurrentStep(idx);
  };

  const handleSubmit = async () => {
    const failed = validateParent();
    // Also validate all subdemands
    subdemands.forEach((s, i) => {
      const f = validateSub(s);
      f.forEach((code) => failed.push(`sub_${i}_${code}`));
    });

    if (failed.length > 0) {
      void logBlockedSubmit({
        formId: `quick-request-${selectedBoardId || "default"}`,
        boardId: selectedBoardId,
        teamId: currentTeamId,
        failedValidations: failed,
        draftSnapshot: { title, description, priority, serviceId, subdemands: draftableSubs },
      });
      toast.error("Complete todas as etapas antes de enviar.");
      // Jump to the first offending step
      if (failed.some((c) => c.startsWith("title_") || c.startsWith("description_") || c.startsWith("service_") || c === "board_missing" || c === "team_missing")) {
        setCurrentStep(0);
      } else {
        const subMatch = failed.find((c) => c.startsWith("sub_"));
        if (subMatch) {
          const idx = Number(subMatch.split("_")[1]);
          setCurrentStep(idx + 1);
        }
      }
      return;
    }

    try {
      const created = await createRequest.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
        board_id: selectedBoardId!,
        team_id: currentTeamId!,
        service_id: serviceId,
        subdemands_plan: subdemands.map((s) => ({
          tempId: s.tempId,
          title: s.title.trim(),
          description: s.description,
          priority: s.priority || "média",
          service_id: s.service_id,
          due_date: s.due_date,
          dependsOnIndex: s.dependsOnIndex,
        })),
      });

      // Upload parent + subdemand attachments
      const allUploads: Array<{ file: File; subdemandIndex?: number }> = [];
      pendingFiles.forEach((pf) => allUploads.push({ file: pf.file }));
      subdemands.forEach((sub, i) => {
        (sub.pendingFiles || []).forEach((pf) => allUploads.push({ file: pf.file, subdemandIndex: i }));
      });

      if (allUploads.length > 0 && created?.id) {
        setIsUploading(true);
        try {
          for (const item of allUploads) {
            await uploadAttachment.mutateAsync({
              requestId: created.id,
              file: item.file,
              subdemandIndex: item.subdemandIndex,
            });
          }
          // Revoke previews
          pendingFiles.forEach((pf) => {
            if (pf.preview) URL.revokeObjectURL(pf.preview);
          });
          subdemands.forEach((sub) => {
            (sub.pendingFiles || []).forEach((pf) => {
              if (pf.preview) URL.revokeObjectURL(pf.preview);
            });
          });
        } catch (err) {
          toast.error("Alguns anexos não foram enviados", {
            description: getErrorMessage(err),
          });
        } finally {
          setIsUploading(false);
        }
      }

      clearDraft();
      toast.success("Solicitação enviada!", {
        description: "Aguarde a aprovação de um administrador ou coordenador.",
      });
      onOpenChange(false);
      resetForm();
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
    pendingFiles.forEach((pf) => {
      if (pf.preview) URL.revokeObjectURL(pf.preview);
    });
    setPendingFiles([]);
    subdemands.forEach((sub) => {
      (sub.pendingFiles || []).forEach((pf) => {
        if (pf.preview) URL.revokeObjectURL(pf.preview);
      });
    });
    setSubdemands([]);
    setCurrentStep(0);
    setMaxVisitedStep(0);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
      clearDraft();
    }
    onOpenChange(isOpen);
  };

  const isReview = currentStep === reviewStepIndex;
  const isFirst = currentStep === 0;
  const busy = createRequest.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto">
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
                  {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </strong>
                . Um administrador ou coordenador irá revisar e aprovar.
              </span>
            ) : (
              <span>Um administrador ou coordenador irá revisar e aprovar sua solicitação.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {subdemandCount > 0 && (
          <div className="pt-1">
            <StepProgress
              currentStep={currentStep}
              totalSteps={totalSteps}
              subdemandCount={subdemandCount}
              stepTitles={stepTitles}
              maxVisitedStep={maxVisitedStep}
              savedSteps={savedSteps}
              onStepClick={jumpTo}
            />
          </div>
        )}

        <div className="space-y-4">
          {currentStep === 0 && (
            <>
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

              <div className="space-y-2">
                <Label>Anexos (opcional)</Label>
                <InlineFileUploader
                  pendingFiles={pendingFiles}
                  onFilesChange={setPendingFiles}
                  disabled={busy}
                />
              </div>

              <div className="pt-1">
                <SubdemandCountStep count={subdemandCount} onChange={setSubdemandCount} />
              </div>
            </>
          )}

          {currentStep > 0 && currentStep < reviewStepIndex && (
            <RequestSubdemandStepForm
              index={currentStep - 1}
              data={subdemands[currentStep - 1]}
              onChange={(data) =>
                setSubdemands((prev) => prev.map((s, i) => (i === currentStep - 1 ? data : s)))
              }
              allSubdemands={subdemands}
              teamId={currentTeamId || null}
              boardId={selectedBoardId || null}
            />
          )}

          {isReview && (
            <RequestReviewStep
              parentTitle={title}
              parentPriority={priority}
              parentDueDate={selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined}
              parentBoardName={currentBoard?.name || ""}
              parentAttachmentsCount={pendingFiles.length}
              subdemands={subdemands}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
          </div>

          <div className="flex gap-2">
            {!isFirst && (
              <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            )}

            {isReview ? (
              <Button type="button" onClick={handleSubmit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                {isUploading ? "Enviando anexos..." : "Enviar Solicitação"}
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={busy}>
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
