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
import { SnapshotColumn, SnapshotDemandInput } from "@/lib/kanbanSnapshot";
import { buildProjectSnapshot, projectSnapshotToCSV } from "@/lib/projectSnapshot";
import { generateProjectSnapshotPDF } from "@/lib/projectSnapshotPdf";
import { useBoardsColumns } from "@/hooks/useBoardsColumns";

interface ProjectSnapshotDialogProps {
  projectName: string;
  authorName: string;
  filteredDemands: (SnapshotDemandInput & { board_id?: string | null; boards?: { name?: string | null } | null })[];
  allDemands: (SnapshotDemandInput & { board_id?: string | null; boards?: { name?: string | null } | null })[];
  hasActiveFilters: boolean;
}

type Scope = "filtered" | "all";

export function ProjectSnapshotDialog({
  projectName,
  authorName,
  filteredDemands,
  allDemands,
  hasActiveFilters,
}: ProjectSnapshotDialogProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(hasActiveFilters ? "filtered" : "all");

  const boardIds = useMemo(
    () => Array.from(new Set(allDemands.map((d) => d.board_id).filter(Boolean) as string[])),
    [allDemands]
  );
  const { data: columnsByBoard = {} } = useBoardsColumns(boardIds);

  const demands = scope === "filtered" ? filteredDemands : allDemands;
  const scopeLabel = scope === "filtered" ? "Somente o que está sendo visto" : "Projeto inteiro";

  const snapshot = useMemo(() => {
    const grouped = new Map<
      string,
      { boardId: string; boardName: string; columns: SnapshotColumn[]; demands: SnapshotDemandInput[] }
    >();
    demands.forEach((d) => {
      const boardId = d.board_id || "sem-quadro";
      if (!grouped.has(boardId)) {
        grouped.set(boardId, {
          boardId,
          boardName: d.boards?.name || "Sem quadro",
          columns: (columnsByBoard as Record<string, SnapshotColumn[]>)[boardId] || [],
          demands: [],
        });
      }
      grouped.get(boardId)!.demands.push(d);
    });

    return buildProjectSnapshot({
      projectName: projectName || "Projeto",
      authorName: authorName || "—",
      scopeLabel,
      boards: Array.from(grouped.values()),
    });
  }, [demands, columnsByBoard, projectName, authorName, scopeLabel]);

  const handlePDF = () => {
    try {
      generateProjectSnapshotPDF(snapshot);
      toast.success("Resumo em PDF baixado");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar o PDF");
    }
  };

  const handleCSV = () => {
    try {
      const csv = projectSnapshotToCSV(snapshot);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const slug = (projectName || "projeto")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      link.download = `resumo-projeto-${slug || "projeto"}-${new Date()
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
        <button className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-lg border border-border/60 hover:bg-muted/60 transition-colors">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="hidden md:inline text-xs font-medium text-muted-foreground">Baixar resumo</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar resumo do projeto</DialogTitle>
          <DialogDescription>
            Um retrato da situação atual, organizado pelos quadros que fazem parte do projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">O que incluir</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="gap-2">
              <label
                htmlFor="project-scope-filtered"
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:border-primary/60 transition-colors"
              >
                <RadioGroupItem value="filtered" id="project-scope-filtered" className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium block">Somente o que estou vendo</span>
                  <span className="text-muted-foreground text-xs">
                    {filteredDemands.length} demanda(s) com os filtros atuais
                  </span>
                </span>
              </label>
              <label
                htmlFor="project-scope-all"
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:border-primary/60 transition-colors"
              >
                <RadioGroupItem value="all" id="project-scope-all" className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium block">Projeto inteiro</span>
                  <span className="text-muted-foreground text-xs">
                    {allDemands.length} demanda(s) no projeto
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {snapshot.overall.overview.total} demanda(s) · {snapshot.boards.length} quadro(s) ·{" "}
            {snapshot.overall.overview.overdue} atrasada(s)
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
