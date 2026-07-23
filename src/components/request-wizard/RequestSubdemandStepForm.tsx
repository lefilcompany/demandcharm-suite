import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ServiceSelector } from "@/components/ServiceSelector";
import { InlineFileUploader, PendingFile } from "@/components/InlineFileUploader";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface RequestSubdemandFormData {
  tempId: string;
  title: string;
  description?: string;
  priority?: string;
  service_id?: string;
  dependsOnIndex?: number;
  pendingFiles?: PendingFile[];
}

interface Props {
  index: number;
  data: RequestSubdemandFormData;
  onChange: (data: RequestSubdemandFormData) => void;
  allSubdemands: RequestSubdemandFormData[];
  teamId: string | null;
  boardId: string | null;
}

export function RequestSubdemandStepForm({
  index,
  data,
  onChange,
  allSubdemands,
  teamId,
  boardId,
}: Props) {
  const update = (partial: Partial<RequestSubdemandFormData>) => {
    onChange({ ...data, ...partial });
  };

  const availableDeps = allSubdemands
    .map((s, i) => ({ ...s, idx: i }))
    .filter(({ idx, title: t }) => idx < index && t.trim() !== "");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Título *</Label>
        <Input
          placeholder={`Ex: Etapa ${index + 1} da solicitação`}
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          className="h-8"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Prioridade *</Label>
          <Select value={data.priority || "média"} onValueChange={(v) => update({ priority: v })}>
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
          <Label>Serviço *</Label>
          <ServiceSelector
            teamId={teamId}
            boardId={boardId}
            value={data.service_id || ""}
            onChange={(id) => update({ service_id: id || undefined })}
          />
        </div>
      </div>

      {availableDeps.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Travamento entre subdemandas
          </Label>
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="whitespace-nowrap text-sm text-muted-foreground">Pode iniciar quando</Label>
            <Select
              value={data.dependsOnIndex !== undefined ? String(data.dependsOnIndex) : "none"}
              onValueChange={(v) => update({ dependsOnIndex: v === "none" ? undefined : Number(v) })}
            >
              <SelectTrigger className="h-8 w-auto min-w-[180px] max-w-[240px]">
                <SelectValue placeholder="Selecionar" />
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
                  Esta subdemanda só poderá ser iniciada depois que a subdemanda selecionada for concluída.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Descrição</Label>
        <RichTextEditor
          value={data.description || ""}
          onChange={(v) => update({ description: v || undefined })}
          placeholder="Descreva os detalhes desta subdemanda..."
          minHeight="80px"
        />
      </div>

      <div className="space-y-2">
        <Label>Anexos</Label>
        <InlineFileUploader
          pendingFiles={data.pendingFiles || []}
          onFilesChange={(files) => update({ pendingFiles: files })}
          disabled={false}
        />
      </div>
    </div>
  );
}
