import { Badge } from "@/components/ui/badge";
import { GitBranch, ArrowRight, Paperclip } from "lucide-react";
import type { SubdemandFormData } from "./SubdemandStepForm";

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

interface ReviewStepProps {
  parentTitle: string;
  parentPriority: string;
  parentStatusId: string;
  parentDueDate: string;
  parentBoardName: string;
  subdemands: SubdemandFormData[];
  statuses: StatusOption[];
}

const priorityLabels: Record<string, string> = {
  baixa: "Baixa",
  média: "Média",
  alta: "Alta",
};

export function ReviewStep({
  parentTitle,
  parentPriority,
  parentStatusId,
  parentDueDate,
  parentBoardName,
  subdemands,
  statuses,
}: ReviewStepProps) {
  const getStatusName = (id: string) => statuses.find((s) => s.id === id)?.name || "—";
  const getStatusColor = (id: string) => statuses.find((s) => s.id === id)?.color || "#6B7280";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Confira os dados antes de criar. Tudo será criado de uma vez.
      </p>

      {/* Parent demand */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate flex-1">{parentTitle || "(sem título)"}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {parentBoardName}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(parentStatusId) }} />
            {getStatusName(parentStatusId)}
          </span>
          <span>{priorityLabels[parentPriority] || parentPriority}</span>
          {parentDueDate && <span>Entrega: {parentDueDate}</span>}
        </div>
      </div>

      {/* Subdemands */}
      {subdemands.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {subdemands.length} Subdemanda{subdemands.length > 1 ? "s" : ""}
          </h4>
          <div className="space-y-2">
            {subdemands.map((sub, idx) => (
              <div
                key={sub.tempId}
                className="rounded-lg border border-border bg-muted/50 p-3 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground shrink-0">#{idx + 1}</span>
                  <span className="text-sm font-medium truncate flex-1">
                    {sub.title || "(sem título)"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getStatusColor(sub.status_id || parentStatusId) }}
                    />
                    {getStatusName(sub.status_id || parentStatusId)}
                  </span>
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
