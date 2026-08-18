import { CalendarClock, ArrowRight, Lock } from "lucide-react";
import { useDueDateHistory } from "@/hooks/useDueDateHistory";
import { formatDateOnlyBR } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";

interface DueDateHistoryProps {
  demandId: string;
  originalDueDate?: string | null;
  currentDueDate?: string | null;
}

export function DueDateHistory({ demandId, originalDueDate, currentDueDate }: DueDateHistoryProps) {
  const { data: changes = [], isLoading } = useDueDateHistory(demandId);

  const firstDeadline = originalDueDate || currentDueDate;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Histórico de prazos
        </h4>
        {changes.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {changes.length} reagendamento{changes.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Prazo inicial (congelado):</span>
        <span className="font-medium">{firstDeadline ? formatDateOnlyBR(firstDeadline) : "—"}</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando histórico...</p>
      ) : changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma alteração de prazo registrada.</p>
      ) : (
        <ul className="space-y-2">
          {changes.map((c) => (
            <li key={c.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="line-through text-muted-foreground">
                  {c.previous_due_date ? formatDateOnlyBR(c.previous_due_date) : "—"}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{c.new_due_date ? formatDateOnlyBR(c.new_due_date) : "—"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.profile?.full_name || "Usuário"} • {formatDateOnlyBR(c.created_at)}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Motivo: </span>
                {c.reason?.trim() || "Sem justificativa registrada"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
