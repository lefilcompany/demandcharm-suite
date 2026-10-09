import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, FileUp, Trash2, Plus, CheckCircle2, AlertCircle, UserPlus, ChevronDown, ChevronUp, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardServices } from "@/hooks/useBoardServices";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";
import { useCreateDemand } from "@/hooks/useDemands";
import { EFFORT_SCALE, PriorityCode, codeFromPriority, priorityFromCode } from "@/lib/importMapping";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Row = {
  key: string;
  title: string;
  description: string;
  service_id: string | null;
  due_date: string | null;
  priority: string;
  priority_code: PriorityCode | null;
  effort_points: number;
  effort_reason: string;
  assigned_to: string | null;
  result?: "ok" | string;
};

type Filter = "all" | "unassigned" | PriorityCode;

const MAX_MB = 10;
const NONE = "__none__";
const stripText = (s: string) => s.replace(/<[^>]*>/g, "").trim();

const CODE_STYLE: Record<PriorityCode, string> = {
  P0: "bg-destructive text-destructive-foreground",
  P1: "bg-primary text-primary-foreground",
  P2: "bg-muted text-muted-foreground",
};

async function readFile(file: File): Promise<{ text?: string; pdf_base64?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { pdf_base64: btoa(bin) };
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: value };
  }
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const text = wb.SheetNames.map((n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n");
    return { text };
  }
  return { text: await file.text() };
}

function PersonPicker({ members, value, onChange, disabled, trigger }: {
  members: { user_id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>{trigger}</PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="end">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList>
            <CommandEmpty>Ninguém com esse nome no quadro.</CommandEmpty>
            <CommandGroup>
              {members.map((m) => (
                <CommandItem key={m.user_id} value={m.name} onSelect={() => { onChange(m.user_id); setOpen(false); }}>
                  <Check className={cn("h-4 w-4 mr-2", value === m.user_id ? "opacity-100" : "opacity-0")} />
                  {m.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ImportDemandsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { boards, selectedBoardId } = useSelectedBoard();
  const [boardId, setBoardId] = useState<string | null>(selectedBoardId);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: services } = useBoardServices(boardId);
  const { data: members } = useBoardMembers(boardId);
  const { data: statuses } = useBoardStatuses(boardId);
  const createDemand = useCreateDemand();
  const board = boards?.find((b) => b.id === boardId);
  const hasServices = (services?.length ?? 0) > 0;
  const people = useMemo(
    () => (members ?? []).filter((m) => m.role !== "requester").map((m) => ({ user_id: m.user_id, name: m.profile?.full_name ?? "—" })),
    [members]
  );
  const nameOf = (id: string | null) => people.find((p) => p.user_id === id)?.name;

  const reset = () => {
    setStep("upload"); setRows([]); setFile(null); setProgress(0); setSelected(new Set()); setFilter("all");
  };

  const analyze = async () => {
    if (!file || !boardId) return;
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Arquivo maior que ${MAX_MB} MB`);
    setBusy(true);
    try {
      const content = await readFile(file);
      const { data, error } = await supabase.functions.invoke("extract-demands-from-document", {
        body: { board_id: boardId, file_name: file.name, ...content },
      });
      if (error || data?.error) {
        let msg = data?.error;
        try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
        throw new Error(msg || "Falha ao analisar o documento");
      }
      const list: Row[] = (data?.demands ?? []).map((d: any, i: number) => ({
        ...d,
        priority_code: d.priority_code ?? null,
        priority: d.priority_code ? priorityFromCode(d.priority_code) : d.priority ?? "média",
        effort_points: d.effort_points ?? 3,
        effort_reason: d.effort_reason ?? "",
        key: `${Date.now()}-${i}`,
      }));
      if (!list.length) return toast.error("Nenhuma demanda encontrada no documento");
      setRows(list);
      setStep("review");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const rowError = (r: Row) => {
    if (!r.title.trim()) return "Título obrigatório";
    if (stripText(r.description).length < 20) return "Descrição com menos de 20 caracteres";
    if (hasServices && !r.service_id) return "Selecione um serviço";
    if (!r.assigned_to) return "Escolha o responsável";
    return null;
  };

  const unassigned = rows.filter((r) => !r.assigned_to).length;
  const invalidCount = rows.filter((r) => rowError(r)).length;
  const counts = { P0: 0, P1: 0, P2: 0 } as Record<PriorityCode, number>;
  rows.forEach((r) => counts[codeFromPriority(r.priority)]++);

  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "unassigned" ? !r.assigned_to : codeFromPriority(r.priority) === filter
  );
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.key));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    visible.forEach((r) => (allVisibleSelected ? n.delete(r.key) : n.add(r.key)));
    return n;
  });
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const assignSelected = (id: string | null) => {
    setRows((r) => r.map((x) => (selected.has(x.key) ? { ...x, assigned_to: id } : x)));
    toast.success(`Responsável atribuído a ${selected.size} demanda(s)`);
    setSelected(new Set());
  };

  const createAll = async () => {
    const status = statuses?.[0];
    if (!board || !status) return toast.error("Quadro sem etapas configuradas");
    setBusy(true); setProgress(0);
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      try {
        const demand: any = await createDemand.mutateAsync({
          title: r.title.trim(),
          description: r.description.trim(),
          team_id: board.team_id,
          board_id: board.id,
          status_id: (status as any).status_id ?? (status as any).id,
          priority: r.priority,
          assigned_to: r.assigned_to ?? undefined,
          due_date: r.due_date ? r.due_date.substring(0, 10) : undefined,
          service_id: r.service_id ?? undefined,
        });
        if (demand?.id) {
          await supabase.from("demands").update({ effort_points: r.effort_points } as any).eq("id", demand.id);
          if (r.assigned_to) {
            await supabase.from("demand_assignees").insert({ demand_id: demand.id, user_id: r.assigned_to, is_primary: true } as any);
          }
        }
        next[i] = { ...r, result: "ok" };
      } catch (e: any) {
        next[i] = { ...r, result: e?.message || "Erro ao criar" };
      }
      setProgress(i + 1);
      setRows([...next]);
    }
    setBusy(false);
    setStep("done");
    const ok = next.filter((r) => r.result === "ok").length;
    toast.success(`${ok} de ${next.length} demandas criadas`);
  };

  const filterChip = (value: Filter, label: string, count: number) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={cn(
        "h-8 px-3 rounded-full border text-xs font-medium transition-colors inline-flex items-center gap-1.5",
        filter === value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
      )}
    >
      {label}<span className="tabular-nums opacity-70">{count}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className={cn("max-h-[92dvh] flex flex-col gap-3", step === "upload" ? "max-w-xl" : "max-w-6xl")}>
        <DialogHeader>
          <DialogTitle>Importar demandas de documento</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Envie um Word, PDF ou Excel. O agente identifica as demandas, lê P0/P1/P2 e estima o esforço; você revisa e escolhe os responsáveis antes de criar."}
            {step === "review" && "Revise a lista e defina quem cuida de cada demanda. Nada é criado até você confirmar."}
            {step === "done" && "Importação concluída."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Quadro de destino</label>
              <Select value={boardId ?? undefined} onValueChange={setBoardId}>
                <SelectTrigger><SelectValue placeholder="Escolha o quadro" /></SelectTrigger>
                <SelectContent>
                  {boards?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label
              className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files?.[0] ?? null); }}
            >
              <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm">{file ? file.name : <>Arraste o arquivo ou <span className="text-primary">clique para selecionar</span></>}</p>
              <p className="text-xs text-muted-foreground mt-1">DOCX, PDF ou Excel (também CSV e TXT) — até {MAX_MB} MB</p>
            </label>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span><b className="text-foreground">P0</b> → alta</span>
              <span><b className="text-foreground">P1</b> → média</span>
              <span><b className="text-foreground">P2</b> → baixa</span>
              <span>Sem código → média</span>
            </div>
            <div className="flex justify-end">
              <Button onClick={analyze} disabled={!file || !boardId || busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {busy ? "Analisando documento..." : "Analisar documento"}
              </Button>
            </div>
          </div>
        )}

        {step !== "upload" && (
          <>
            {step === "review" && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {filterChip("all", "Todas", rows.length)}
                {filterChip("unassigned", "Sem responsável", unassigned)}
                {filterChip("P0", "P0", counts.P0)}
                {filterChip("P1", "P1", counts.P1)}
                {filterChip("P2", "P2", counts.P2)}
                <div className="ml-auto flex items-center gap-2">
                  {selected.size > 0 && (
                    <PersonPicker
                      members={people}
                      value={null}
                      onChange={assignSelected}
                      trigger={
                        <Button size="sm" className="h-8 gap-1.5">
                          <UserPlus className="h-4 w-4" /> Atribuir responsável ({selected.size})
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border">
              <div className="sticky top-0 z-10 grid grid-cols-[28px_44px_minmax(0,1fr)_150px_120px_96px_180px_32px] items-center gap-2 px-3 h-9 bg-muted text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                <span>{step === "review" && <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Selecionar todas" />}</span>
                <span>Prior.</span>
                <span>Demanda</span>
                <span>Serviço</span>
                <span>Prazo</span>
                <span>Esforço</span>
                <span>Responsável</span>
                <span />
              </div>
              {visible.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma demanda neste filtro.</p>
              )}
              {visible.map((r) => {
                const err = rowError(r);
                const code = codeFromPriority(r.priority);
                const isOpen = expanded === r.key;
                const locked = step === "done";
                return (
                  <div key={r.key} className={cn("border-b last:border-0 border-l-4", !r.assigned_to && step === "review" ? "border-l-primary" : "border-l-transparent")}>
                    <div className="grid grid-cols-[28px_44px_minmax(0,1fr)_150px_120px_96px_180px_32px] items-center gap-2 px-3 py-2">
                      <span>{step === "review" && <Checkbox checked={selected.has(r.key)} onCheckedChange={() => toggle(r.key)} aria-label="Selecionar" />}</span>
                      <Select disabled={locked} value={code} onValueChange={(v) => update(r.key, { priority: priorityFromCode(v), priority_code: v as PriorityCode })}>
                        <SelectTrigger className={cn("h-7 px-1.5 text-[11px] font-bold border-0 justify-center [&>svg]:hidden", CODE_STYLE[code])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="P0">P0 · alta</SelectItem>
                          <SelectItem value="P1">P1 · média</SelectItem>
                          <SelectItem value="P2">P2 · baixa</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="min-w-0 flex items-center gap-1">
                        <Input value={r.title} disabled={locked} placeholder="Título" className="h-8 text-sm"
                          onChange={(e) => update(r.key, { title: e.target.value })} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setExpanded(isOpen ? null : r.key)} aria-label="Ver descrição">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Select disabled={locked} value={r.service_id ?? NONE} onValueChange={(v) => update(r.key, { service_id: v === NONE ? null : v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Serviço" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sem serviço</SelectItem>
                          {services?.map((s: any) => s.service && <SelectItem key={s.service.id} value={s.service.id}>{s.service.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="date" className="h-8 text-xs" disabled={locked} value={r.due_date ?? ""}
                        onChange={(e) => update(r.key, { due_date: e.target.value || null })} />
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div>
                              <Select disabled={locked} value={String(r.effort_points)} onValueChange={(v) => update(r.key, { effort_points: Number(v) })}>
                                <SelectTrigger className="h-8 text-xs rounded-full tabular-nums"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {EFFORT_SCALE.map((n) => <SelectItem key={n} value={String(n)}>{n} pts</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </TooltipTrigger>
                          {r.effort_reason && <TooltipContent side="top"><p className="text-xs max-w-[220px]">{r.effort_reason}</p></TooltipContent>}
                        </Tooltip>
                      </TooltipProvider>
                      <PersonPicker
                        members={people}
                        value={r.assigned_to}
                        onChange={(id) => update(r.key, { assigned_to: id })}
                        disabled={locked}
                        trigger={
                          <Button variant="outline" size="sm" disabled={locked}
                            className={cn("h-8 justify-between text-xs font-normal", !r.assigned_to && "border-primary text-primary")}>
                            <span className="truncate">{nameOf(r.assigned_to) ?? "Escolher responsável"}</span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                          </Button>
                        }
                      />
                      <span className="flex justify-center">
                        {step === "review" ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label="Remover"
                            onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : r.result === "ok" ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="px-3 pb-3 pl-[88px] space-y-1">
                        <Textarea rows={3} value={r.description} disabled={locked} placeholder="Descrição"
                          onChange={(e) => update(r.key, { description: e.target.value })} />
                        {r.effort_reason && <p className="text-xs text-muted-foreground">Esforço: {r.effort_reason}</p>}
                      </div>
                    )}
                    {step === "review" && err && err !== "Escolha o responsável" && (
                      <p className="px-3 pb-2 pl-[88px] text-xs text-destructive">{err}</p>
                    )}
                    {step === "done" && r.result && r.result !== "ok" && <p className="px-3 pb-2 pl-[88px] text-xs text-destructive">{r.result}</p>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 shrink-0">
              {step === "review" ? (
                <>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" disabled={busy || rows.length >= 50}
                      onClick={() => setRows([...rows, { key: `${Date.now()}`, title: "", description: "", service_id: null, due_date: null, priority: "média", priority_code: null, effort_points: 3, effort_reason: "", assigned_to: null }])}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar linha
                    </Button>
                    <span className={cn("text-xs", invalidCount ? "text-primary font-medium" : "text-muted-foreground")}>
                      {unassigned > 0 ? `${unassigned} sem responsável` : invalidCount > 0 ? `${invalidCount} com pendência` : "Tudo pronto para criar"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled={busy} onClick={reset}>Voltar</Button>
                    <Button onClick={createAll} disabled={busy || invalidCount > 0 || !rows.length}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {busy ? `Criando ${progress}/${rows.length}...` : `Criar ${rows.length} demandas`}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {rows.filter((r) => r.result === "ok").length} criadas · {rows.filter((r) => r.result && r.result !== "ok").length} com erro
                  </span>
                  <Button onClick={() => { onOpenChange(false); reset(); }}>Concluir</Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
