import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SnapshotColumn, SnapshotDemandInput, buildKanbanSnapshot } from "@/lib/kanbanSnapshot";
import { downloadSnapshotXlsx, slugify } from "@/lib/snapshotXlsx";
import { SPRINT_STATUS_LABEL, formatDaysRemaining, type SprintStatus } from "@/lib/sprints";
import { buildDevSheetMetrics, buildDiffEvents, type CapabilityGroup, type DevSheetDemand, type DevSheetInput } from "@/lib/sprintDevSheet";
import { generateSprintDevSheetPDF } from "@/lib/sprintDevSheetPdf";

interface Props {
  boardName: string;
  authorName: string;
  sprint: { id: string; board_id: string; name: string; start_date: string; end_date: string; status: SprintStatus; goal: string | null };
  columns: SnapshotColumn[];
  demands: SnapshotDemandInput[];
}

const fmt = (d: string) => d.substring(0, 10).split("-").reverse().join("/");

async function loadHistory(sprint: Props["sprint"], ids: string[]) {
  const [own, others, facts, dues, times] = await Promise.all([
    supabase.from("sprint_demands").select("demand_id, added_at").eq("sprint_id", sprint.id),
    supabase.from("sprint_demands").select("demand_id, board_sprints!inner(id, status, end_date)").in("demand_id", ids).neq("sprint_id", sprint.id),
    supabase.from("demands").select("id, effort_points, status_changed_at, delivered_at, due_date").in("id", ids),
    supabase.from("demand_due_date_changes").select("demand_id, previous_due_date, new_due_date, created_at, changed_by").in("demand_id", ids),
    supabase.from("demand_time_entries").select("demand_id, duration_seconds").in("demand_id", ids),
  ]);
  for (const r of [own, others, facts, dues, times]) if (r.error) throw r.error;
  const changers = [...new Set((dues.data ?? []).map((d) => d.changed_by).filter(Boolean))] as string[];
  const names: Record<string, string> = {};
  if (changers.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", changers);
    (data ?? []).forEach((p: any) => (names[p.id] = p.full_name));
  }
  const secondsByDemand: Record<string, number> = {};
  (times.data ?? []).forEach((t: any) => (secondsByDemand[t.demand_id] = (secondsByDemand[t.demand_id] ?? 0) + (t.duration_seconds ?? 0)));
  return {
    addedAt: Object.fromEntries((own.data ?? []).map((r: any) => [r.demand_id, r.added_at])),
    carriedIds: new Set(
      (others.data ?? [])
        .filter((r: any) => r.board_sprints.status === "completed")
        .map((r: any) => r.demand_id as string)
    ),
    facts: Object.fromEntries((facts.data ?? []).map((f: any) => [f.id, f])),
    dueChanges: (dues.data ?? []).map((d: any) => ({ ...d, changed_by_name: d.changed_by ? names[d.changed_by] : null })),
    secondsByDemand,
  };
}

export function SprintSnapshotDialog({ boardName, authorName, sprint, columns, demands }: Props) {
  const [open, setOpen] = useState(false);
  const [caps, setCaps] = useState<CapabilityGroup[] | null>(null);
  const [capsLoading, setCapsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const period = `${fmt(sprint.start_date)} – ${fmt(sprint.end_date)}`;
  const scopeLabel = `Sprint ${sprint.name} · ${period} · ${SPRINT_STATUS_LABEL[sprint.status]}`;
  const snapshot = useMemo(
    () => buildKanbanSnapshot({ boardName: boardName || "Quadro", authorName: authorName || "—", scopeLabel, columns, demands }),
    [boardName, authorName, scopeLabel, columns, demands]
  );
  const base = `sprint-${slugify(sprint.name) || "sprint"}`;

  const generateCaps = async () => {
    setCapsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sprint-release-notes", { body: { sprintId: sprint.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCaps((data as any).groups ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar as novidades");
    } finally {
      setCapsLoading(false);
    }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && caps === null && !capsLoading) generateCaps();
  };

  const handlePDF = async () => {
    setBusy(true);
    try {
      await buildSprintDevSheet({ boardName, authorName, sprint, snapshot, caps: caps ?? [] });
      toast.success("Ficha da sprint baixada");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar a ficha");
    } finally {
      setBusy(false);
    }
  };

  const handleXlsx = async () => {
    try {
      await buildSprintXlsx({ boardName, sprint, snapshot });
      toast.success("Planilha Excel baixada");
      setOpen(false);
    } catch {
      toast.error("Não foi possível gerar a planilha");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!demands.length}>
          <Download className="h-4 w-4" /> Baixar resumo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ficha da sprint</DialogTitle>
          <DialogDescription>Novidades entregues, mudanças registradas (diffs), relatório e lista de demandas.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          {sprint.name} · {period} · {snapshot.overview.total} demanda(s) · {snapshot.overview.delivered} entregue(s)
        </div>
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />O que agora é possível</span>
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={generateCaps} disabled={capsLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${capsLoading ? "animate-spin" : ""}`} /> Gerar de novo
            </Button>
          </div>
          <div className="max-h-56 overflow-y-auto text-sm">
            {capsLoading ? (
              <p className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />A IA está lendo as entregas…</p>
            ) : caps && caps.length ? (
              caps.map((g) => (
                <div key={g.service} className="mb-2">
                  <p className="text-xs font-semibold text-primary">{g.service}</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {g.items.map((i, k) => (
                      <li key={k}>{i.text} {i.codes.length > 0 && <span className="text-muted-foreground">({i.codes.join(", ")})</span>}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Nenhuma entrega nesta sprint ainda.</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handlePDF} className="gap-2" disabled={busy || capsLoading}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Ficha (PDF)
          </Button>
          <Button onClick={handleXlsx} variant="outline" className="gap-2"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Snapshot = ReturnType<typeof buildKanbanSnapshot>;

export async function buildSprintDevSheet(
  { boardName, authorName, sprint, snapshot, caps }: { boardName: string; authorName: string; sprint: Props["sprint"]; snapshot: Snapshot; caps: CapabilityGroup[] },
  asBlob = false,
): Promise<Blob | void> {
  const period = `${fmt(sprint.start_date)} – ${fmt(sprint.end_date)}`;
  const scopeLabel = `Sprint ${sprint.name} · ${period} · ${SPRINT_STATUS_LABEL[sprint.status]}`;
  const ids = snapshot.rows.map((r) => r.id);
  const h = await loadHistory(sprint, ids);
  const devDemands: DevSheetDemand[] = snapshot.rows.map((r) => {
    const f = h.facts[r.id] ?? {};
    return {
      id: r.id, code: r.code, title: r.title, stage: r.stage, isDelivered: r.isDelivered,
      deliveredAt: f.delivered_at ?? null, dueDate: f.due_date ?? r.dueDate, statusChangedAt: f.status_changed_at ?? null,
      effort: f.effort_points ?? null, responsible: r.responsible,
    };
  });
  const input: DevSheetInput = { sprint, demands: devDemands, addedAt: h.addedAt, carriedIds: h.carriedIds, dueChanges: h.dueChanges, secondsByDemand: h.secondsByDemand };
  return generateSprintDevSheetPDF({
    meta: { title: `Ficha da sprint — ${sprint.name}`, subtitle: `${boardName} · ${period}`, generatedAt: new Date(), scopeLabel, authorName: authorName || "—" },
    sprint: { name: sprint.name, period, status: SPRINT_STATUS_LABEL[sprint.status], goal: sprint.goal },
    boardName,
    capabilities: caps,
    events: buildDiffEvents(input),
    metrics: buildDevSheetMetrics(input),
    demands: devDemands,
    extra: Object.fromEntries(snapshot.rows.map((r) => [r.id, { service: r.service, priority: r.priority }])),
  }, { asBlob });
}

export async function buildSprintXlsx(
  { boardName, sprint, snapshot }: { boardName: string; sprint: Props["sprint"]; snapshot: Snapshot },
  asBlob = false,
): Promise<Blob | void> {
  const period = `${fmt(sprint.start_date)} – ${fmt(sprint.end_date)}`;
  return downloadSnapshotXlsx(snapshot, {
    title: `Resumo da sprint — ${sprint.name}`,
    fileName: `sprint-${slugify(sprint.name) || "sprint"}-${slugify(boardName) || "quadro"}-${new Date().toISOString().substring(0, 10)}.xlsx`,
    asBlob,
    extraInfo: [
      ["Sprint", sprint.name],
      ["Período", period],
      ["Situação", SPRINT_STATUS_LABEL[sprint.status]],
      ...(sprint.status !== "completed" ? [["Prazo", formatDaysRemaining(sprint.end_date)] as [string, string]] : []),
      ...(sprint.goal ? [["Objetivo", sprint.goal] as [string, string]] : []),
    ],
  });
}

/** Gera a ficha (PDF) e a lista de demandas (Excel) da sprint como arquivos, para guardar nos artefatos. */
export async function buildSprintArtifactFiles(p: { boardName: string; authorName: string; sprint: Props["sprint"]; columns: SnapshotColumn[]; demands: SnapshotDemandInput[] }) {
  const period = `${fmt(p.sprint.start_date)} – ${fmt(p.sprint.end_date)}`;
  const scopeLabel = `Sprint ${p.sprint.name} · ${period} · ${SPRINT_STATUS_LABEL[p.sprint.status]}`;
  const snapshot = buildKanbanSnapshot({ boardName: p.boardName || "Quadro", authorName: p.authorName || "—", scopeLabel, columns: p.columns, demands: p.demands });
  let caps: CapabilityGroup[] = [];
  try {
    const { data } = await supabase.functions.invoke("sprint-release-notes", { body: { sprintId: p.sprint.id } });
    caps = (data as any)?.groups ?? [];
  } catch { /* ficha sai sem a lista da IA */ }
  const pdf = (await buildSprintDevSheet({ ...p, snapshot, caps }, true)) as Blob;
  const xlsx = (await buildSprintXlsx({ boardName: p.boardName, sprint: p.sprint, snapshot }, true)) as Blob;
  return { pdf, xlsx };
}
