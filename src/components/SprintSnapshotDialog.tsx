import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { SnapshotColumn, SnapshotDemandInput, buildKanbanSnapshot } from "@/lib/kanbanSnapshot";
import { generateKanbanSnapshotPDF } from "@/lib/kanbanSnapshotPdf";
import { downloadSnapshotXlsx, slugify } from "@/lib/snapshotXlsx";
import { SPRINT_STATUS_LABEL, formatDaysRemaining, type SprintStatus } from "@/lib/sprints";

interface Props {
  boardName: string;
  authorName: string;
  sprint: { name: string; start_date: string; end_date: string; status: SprintStatus; goal: string | null };
  columns: SnapshotColumn[];
  demands: SnapshotDemandInput[];
}

const fmt = (d: string) => d.substring(0, 10).split("-").reverse().join("/");

export function SprintSnapshotDialog({ boardName, authorName, sprint, columns, demands }: Props) {
  const [open, setOpen] = useState(false);
  const period = `${fmt(sprint.start_date)} – ${fmt(sprint.end_date)}`;
  const snapshot = useMemo(
    () => buildKanbanSnapshot({
      boardName: boardName || "Quadro",
      authorName: authorName || "—",
      scopeLabel: `Sprint ${sprint.name} · ${period} · ${SPRINT_STATUS_LABEL[sprint.status]}`,
      columns,
      demands,
    }),
    [boardName, authorName, sprint, period, columns, demands]
  );
  const base = `sprint-${slugify(sprint.name) || "sprint"}`;

  const handlePDF = () => {
    try {
      generateKanbanSnapshotPDF(snapshot, { title: `Resumo da sprint — ${sprint.name}`, subtitle: `${boardName} · ${period}`, filePrefix: base });
      toast.success("Resumo em PDF baixado");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar o PDF");
    }
  };

  const handleXlsx = async () => {
    try {
      await downloadSnapshotXlsx(snapshot, {
        title: `Resumo da sprint — ${sprint.name}`,
        fileName: `${base}-${slugify(boardName) || "quadro"}-${new Date().toISOString().substring(0, 10)}.xlsx`,
        extraInfo: [
          ["Sprint", sprint.name],
          ["Período", period],
          ["Situação", SPRINT_STATUS_LABEL[sprint.status]],
          ...(sprint.status !== "completed" ? [["Prazo", formatDaysRemaining(sprint.end_date)] as [string, string]] : []),
          ...(sprint.goal ? [["Objetivo", sprint.goal] as [string, string]] : []),
        ],
      });
      toast.success("Planilha Excel baixada");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar a planilha");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!demands.length}>
          <Download className="h-4 w-4" /> Baixar resumo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar resumo da sprint</DialogTitle>
          <DialogDescription>Retrato atual da sprint: demandas por etapa, responsáveis, prazos e prioridades.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          {sprint.name} · {period} · {snapshot.overview.total} demanda(s) · {snapshot.overview.overdue} atrasada(s)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handlePDF} className="gap-2"><FileText className="h-4 w-4" />PDF</Button>
          <Button onClick={handleXlsx} variant="outline" className="gap-2"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
