import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarRange, CheckCircle2, Pencil, Play, Plus, RefreshCw, Rocket, Trash2, X } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { KanbanBoard } from "@/components/KanbanBoard";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useBoard } from "@/hooks/useBoards";
import { useDemands } from "@/hooks/useDemands";
import { useKanbanColumns } from "@/hooks/useBoardStatuses";
import { useRealtimeDemands } from "@/hooks/useRealtimeDemands";
import {
  Sprint, useSprints, useSprintMemberships, useSaveSprint, useDeleteSprint,
  useAddDemandsToSprint, useRemoveDemandFromSprint, useCompleteSprint,
} from "@/hooks/useSprints";
import { SPRINT_STATUS_LABEL, formatDaysRemaining, sprintProgress, todayIso, canAddDemandToSprint } from "@/lib/sprints";
import { openDemandOnAuxClick } from "@/lib/demandAuxClick";

const fmt = (d: string) => d.substring(0, 10).split("-").reverse().join("/");
const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default", planned: "secondary", completed: "outline",
};

export default function Sprints() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBoardId } = useSelectedBoard();
  const { data: role } = useBoardRole(selectedBoardId);
  const { data: board } = useBoard(selectedBoardId);
  const canEdit = !!role && role !== "requester";
  const { data: sprints, isLoading, isError, refetch } = useSprints(selectedBoardId);
  const { data: memberships = [] } = useSprintMemberships(selectedBoardId);
  const { data: demands = [] } = useDemands(selectedBoardId || undefined);
  const { columns } = useKanbanColumns(selectedBoardId, role);
  useRealtimeDemands(selectedBoardId || undefined);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [editing, setEditing] = useState<Partial<Sprint> | null>(null);
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!sprints?.length) { setSelectedId(null); return; }
    if (selectedId && sprints.some((s) => s.id === selectedId)) return;
    setSelectedId((sprints.find((s) => s.status === "active") ?? sprints[0]).id);
  }, [sprints, selectedId]);

  const sprint = sprints?.find((s) => s.id === selectedId) ?? null;
  const sprintDemandIds = useMemo(
    () => new Set(memberships.filter((m) => m.sprint_id === selectedId).map((m) => m.demand_id)),
    [memberships, selectedId]
  );
  const sprintDemands = useMemo(() => (demands as any[]).filter((d) => sprintDemandIds.has(d.id)), [demands, sprintDemandIds]);
  const progress = sprintProgress(sprintDemands);

  const save = useSaveSprint();
  const del = useDeleteSprint();
  const remove = useRemoveDemandFromSprint();
  const onError = (e: any) => toast({ title: "Erro", description: e?.message ?? String(e), variant: "destructive" });

  const startSprint = () => sprint && save.mutate({ ...sprint, status: "active" }, {
    onSuccess: () => toast({ title: "Sprint iniciada" }), onError,
  });

  if (!selectedBoardId) {
    return <div className="text-center py-12 text-muted-foreground">Selecione um quadro para ver as sprints.</div>;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in gap-4">
      <SEOHead title="Sprints" path="/app/sprints" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Sprints</h1>
          <p className="text-sm text-muted-foreground">Ciclos de trabalho do quadro {board?.name ?? ""}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({ start_date: todayIso(), end_date: todayIso() })} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova sprint
          </Button>
        )}
      </div>

      {isError ? (
        <div className="border rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="text-sm">Não foi possível carregar as sprints.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-4 w-4" />Tentar novamente</Button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !sprints?.length ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
          <Rocket className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma sprint neste quadro</p>
          {canEdit && <p className="text-sm text-muted-foreground">Crie a primeira para organizar o trabalho por período.</p>}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            {sprints.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${s.id === selectedId ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant={statusVariant[s.status]} className="text-[10px]">{SPRINT_STATUS_LABEL[s.status]}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{fmt(s.start_date)} – {fmt(s.end_date)}</span>
              </button>
            ))}
          </div>

          {sprint && (
            <div className="rounded-xl border bg-card p-4 space-y-3 shrink-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{sprint.name}</h2>
                    <Badge variant={statusVariant[sprint.status]}>{SPRINT_STATUS_LABEL[sprint.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarRange className="h-3.5 w-3.5" /> {fmt(sprint.start_date)} – {fmt(sprint.end_date)}
                    {sprint.status !== "completed" && <> · {formatDaysRemaining(sprint.end_date)}</>}
                  </p>
                  {sprint.goal && <p className="text-sm mt-1">{sprint.goal}</p>}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    {sprint.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="h-4 w-4" />Demandas</Button>
                    )}
                    {sprint.status === "planned" && (
                      <Button size="sm" onClick={startSprint} className="gap-1.5"><Play className="h-4 w-4" />Iniciar</Button>
                    )}
                    {sprint.status === "active" && (
                      <Button size="sm" onClick={() => setCompleting(true)} className="gap-1.5"><CheckCircle2 className="h-4 w-4" />Concluir</Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(sprint)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Excluir"
                      onClick={() => { if (confirm(`Excluir a sprint "${sprint.name}"? As demandas não são apagadas.`)) del.mutate(sprint.id, { onError }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex-1 min-w-[200px]">
                  <Progress value={progress.percent} className="h-2" />
                </div>
                <span><b>{progress.delivered}</b>/{progress.total} entregues ({progress.percent}%)</span>
                <span className={progress.overdue ? "text-destructive font-medium" : "text-muted-foreground"}>{progress.overdue} atrasada{progress.overdue === 1 ? "" : "s"}</span>
                <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
                    <TabsTrigger value="list" className="text-xs">Lista</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          )}

          {sprint && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {sprintDemands.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma demanda nesta sprint ainda.</p>
              ) : view === "kanban" ? (
                <KanbanBoard
                  demands={sprintDemands}
                  columns={columns}
                  onDemandClick={(id) => navigate(`/app/demands/${id}`)}
                  readOnly={!canEdit}
                  userRole={role || undefined}
                  boardName={board?.name}
                  boardId={selectedBoardId}
                  initialColumnsOpen
                />
              ) : (
                <div className="h-full overflow-y-auto space-y-4 pr-1">
                  {columns.map((col: any) => {
                    const items = sprintDemands.filter((d) => d.status_id === col.statusId || (!col.statusId && d.demand_statuses?.name === col.label));
                    if (!items.length) return null;
                    return (
                      <div key={col.key} className="rounded-xl border bg-card">
                        <div className="px-3 py-2 border-b flex items-center gap-2 text-sm font-medium">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                          {col.label} <span className="text-muted-foreground">({items.length})</span>
                        </div>
                        {items.map((d) => (
                          <div key={d.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate(`/app/demands/${d.id}`)}
                            onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
                            onAuxClick={(e) => openDemandOnAuxClick(e, d.id)}>
                            <span className="text-xs text-muted-foreground w-10">#{d.board_sequence_number ?? ""}</span>
                            <span className="flex-1 text-sm truncate">{d.title}</span>
                            {d.priority && <Badge variant="outline" className="text-[10px] capitalize">{d.priority}</Badge>}
                            <span className="text-xs text-muted-foreground w-28 truncate">
                              {d.demand_assignees?.find((a: any) => a.is_primary)?.profile?.full_name ?? d.demand_assignees?.[0]?.profile?.full_name ?? "—"}
                            </span>
                            <span className="text-xs text-muted-foreground w-20">{d.due_date ? fmt(d.due_date) : "Sem prazo"}</span>
                            {canEdit && sprint.status !== "completed" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover da sprint"
                                onClick={(e) => { e.stopPropagation(); remove.mutate({ sprintId: sprint.id, demandId: d.id }, { onError }); }}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <SprintFormDialog initial={editing} boardId={selectedBoardId} onClose={() => setEditing(null)} />
      )}
      {adding && sprint && (
        <AddDemandsDialog sprint={sprint} demands={demands as any[]} memberships={memberships} onClose={() => setAdding(false)} />
      )}
      {completing && sprint && (
        <CompleteSprintDialog sprint={sprint} others={(sprints ?? []).filter((s) => s.id !== sprint.id && s.status === "planned")}
          pending={progress.total - progress.delivered} onClose={() => setCompleting(false)} />
      )}
    </div>
  );
}

function SprintFormDialog({ initial, boardId, onClose }: { initial: Partial<Sprint>; boardId: string; onClose: () => void }) {
  const { toast } = useToast();
  const save = useSaveSprint();
  const [form, setForm] = useState({
    name: initial.name ?? "", goal: initial.goal ?? "",
    start_date: (initial.start_date ?? "").substring(0, 10), end_date: (initial.end_date ?? "").substring(0, 10),
  });
  const invalid = !form.name.trim() || !form.start_date || !form.end_date || form.end_date < form.start_date;
  const submit = () => save.mutate({ ...initial, ...form, board_id: boardId, goal: form.goal || null } as any, {
    onSuccess: () => { toast({ title: initial.id ? "Sprint atualizada" : "Sprint criada" }); onClose(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial.id ? "Editar sprint" : "Nova sprint"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sprint 1" /></div>
          <div><Label>Objetivo (opcional)</Label><Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          {form.end_date && form.start_date && form.end_date < form.start_date && (
            <p className="text-xs text-destructive">O fim precisa ser igual ou depois do início.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={invalid || save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDemandsDialog({ sprint, demands, memberships, onClose }: {
  sprint: Sprint; demands: any[]; memberships: { demand_id: string; sprint_id: string; sprint_status: any }[]; onClose: () => void;
}) {
  const { toast } = useToast();
  const add = useAddDemandsToSprint();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const available = demands.filter((d) =>
    !d.delivered_at &&
    !memberships.some((m) => m.demand_id === d.id && m.sprint_id === sprint.id) &&
    canAddDemandToSprint(d.id, sprint.id, memberships)
  ).filter((d) => {
    const q = search.trim().toLowerCase();
    return !q || d.title?.toLowerCase().includes(q) || String(d.board_sequence_number ?? "").includes(q.replace("#", ""));
  });
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const submit = () => add.mutate({ sprintId: sprint.id, demandIds: [...picked] }, {
    onSuccess: () => { toast({ title: `${picked.size} demanda(s) adicionada(s)` }); onClose(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Adicionar demandas a {sprint.name}</DialogTitle></DialogHeader>
        <Input placeholder="Buscar por título ou número" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="text-xs text-muted-foreground">Demandas já em outra sprint em aberto não aparecem.</p>
        <div className="max-h-[50dvh] overflow-y-auto border rounded-lg divide-y">
          {available.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma demanda disponível.</p>
          ) : available.map((d) => (
            <label key={d.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
              <Checkbox checked={picked.has(d.id)} onCheckedChange={() => toggle(d.id)} />
              <span className="text-xs text-muted-foreground w-10">#{d.board_sequence_number ?? ""}</span>
              <span className="flex-1 text-sm truncate">{d.title}</span>
              <span className="text-xs text-muted-foreground">{d.demand_statuses?.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!picked.size || add.isPending}>Adicionar {picked.size || ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteSprintDialog({ sprint, others, pending, onClose }: { sprint: Sprint; others: Sprint[]; pending: number; onClose: () => void }) {
  const { toast } = useToast();
  const complete = useCompleteSprint();
  const [carry, setCarry] = useState<string>(others[0]?.id ?? "none");
  const submit = () => complete.mutate({ sprintId: sprint.id, carryTo: carry === "none" ? null : carry }, {
    onSuccess: (moved) => { toast({ title: "Sprint concluída", description: moved ? `${moved} demanda(s) movida(s) para a próxima sprint.` : undefined }); onClose(); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Concluir {sprint.name}</DialogTitle></DialogHeader>
        <p className="text-sm">{pending} demanda(s) ainda não foram entregues.</p>
        {pending > 0 && (
          <div className="space-y-1">
            <Label>O que fazer com elas?</Label>
            <Select value={carry} onValueChange={setCarry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {others.map((s) => <SelectItem key={s.id} value={s.id}>Mover para {s.name}</SelectItem>)}
                <SelectItem value="none">Deixar sem sprint</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={complete.isPending}>Concluir sprint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
