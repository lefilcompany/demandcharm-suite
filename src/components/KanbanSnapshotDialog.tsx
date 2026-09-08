import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  SnapshotColumn,
  SnapshotDemandInput,
  buildKanbanSnapshot,
  snapshotToCSV,
} from "@/lib/kanbanSnapshot";
import { generateKanbanSnapshotPDF } from "@/lib/kanbanSnapshotPdf";

interface KanbanSnapshotDialogProps {
  boardName: string;
  authorName: string;
  columns: SnapshotColumn[];
  filteredDemands: SnapshotDemandInput[];
  allDemands: SnapshotDemandInput[];
  hasActiveFilters: boolean;
}

type Scope = "filtered" | "all";

export function KanbanSnapshotDialog({
  boardName,
  authorName,
  columns,
  filteredDemands,
  allDemands,
  hasActiveFilters,
}: KanbanSnapshotDialogProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(hasActiveFilters ? "filtered" : "all");

  const demands = scope === "filtered" ? filteredDemands : allDemands;
  const scopeLabel = scope === "filtered" ? "Somente o que está sendo visto" : "Quadro inteiro";

  const snapshot = useMemo(
    () =>
      buildKanbanSnapshot({
        boardName: boardName || "Quadro",
        authorName: authorName || "—",
        scopeLabel,
        columns,
        demands,
      }),
    [boardName, authorName, scopeLabel, columns, demands]
  );

  const handlePDF = () => {
    try {
      generateKanbanSnapshotPDF(snapshot);
      toast.success("Resumo em PDF baixado");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar o PDF");
    }
  };

  const handleCSV = () => {
    try {
      const csv = snapshotToCSV(snapshot);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const slug = (boardName || "quadro")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      link.download = `resumo-kanban-${slug || "quadro"}-${new Date()
        .toISOString()
        .substring(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha baixada");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar a planilha");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Baixar resumo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar resumo do quadro</DialogTitle>
          <DialogDescription>
            Um retrato da situação atual: demandas por etapa, responsáveis, prazos e prioridades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que incluir</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="gap-2">
              <label
                htmlFor="scope-filtered"
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:border-primary/60 transition-colors"
              >
                <RadioGroupItem value="filtered" id="scope-filtered" className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium block">Somente o que estou vendo</span>
                  <span className="text-muted-foreground text-xs">
                    {filteredDemands.length} demanda(s) com os filtros atuais
                  </span>
                </span>
              </label>
              <label
                htmlFor="scope-all"
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:border-primary/60 transition-colors"
              >
                <RadioGroupItem value="all" id="scope-all" className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium block">Quadro inteiro</span>
                  <span className="text-muted-foreground text-xs">
                    {allDemands.length} demanda(s) ativas
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {snapshot.overview.total} demanda(s) · {snapshot.overview.overdue} atrasada(s) ·{" "}
            {snapshot.overview.people} responsável(is)
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handlePDF} className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleCSV} variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Planilha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
