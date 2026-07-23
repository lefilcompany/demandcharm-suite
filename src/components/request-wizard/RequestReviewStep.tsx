import { Badge } from "@/components/ui/badge";
import { GitBranch, ArrowRight, Paperclip } from "lucide-react";
import type { RequestSubdemandFormData } from "./RequestSubdemandStepForm";

const priorityLabels: Record<string, string> = {
  baixa: "Baixa",
  média: "Média",
  alta: "Alta",
};

interface Props {
  parentTitle: string;
  parentPriority: string;
  parentDueDate?: string | null;
  parentBoardName: string;
  parentAttachmentsCount: number;
  subdemands: RequestSubdemandFormData[];
}

export function RequestReviewStep({
  parentTitle,
  parentPriority,
  parentDueDate,
  parentBoardName,
  parentAttachmentsCount,
  subdemands,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira os dados antes de enviar. Um administrador ou coordenador irá revisar e aprovar.
      </p>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate flex-1">{parentTitle || "(sem título)"}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {parentBoardName}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{priorityLabels[parentPriority] || parentPriority}</span>
          {parentDueDate && <span>Entrega desejada: {parentDueDate}</span>}
          {parentAttachmentsCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {parentAttachmentsCount} anexo{parentAttachmentsCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {subdemands.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {subdemands.length} Subdemanda{subdemands.length > 1 ? "s" : ""}
          </h4>
          <div className="space-y-2">
            {subdemands.map((sub, idx) => (
              <div key={sub.tempId} className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground shrink-0">#{idx + 1}</span>
                  <span className="text-sm font-medium truncate flex-1">
                    {sub.title || "(sem título)"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  <span>{priorityLabels[sub.priority || "média"] || sub.priority}</span>
                  {sub.due_date && <span>Entrega: {sub.due_date}</span>}
                  {sub.pendingFiles && sub.pendingFiles.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {sub.pendingFiles.length} anexo{sub.pendingFiles.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {sub.dependsOnIndex !== undefined && (
                    <span className="flex items-center gap-1 text-primary">
                      <ArrowRight className="h-3 w-3" />
                      Depende de #{sub.dependsOnIndex + 1}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
