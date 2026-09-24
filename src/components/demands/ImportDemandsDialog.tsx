import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileUp, Trash2, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useBoardServices } from "@/hooks/useBoardServices";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";
import { useCreateDemand } from "@/hooks/useDemands";
import { toast } from "sonner";

type Row = {
  key: string;
  title: string;
  description: string;
  service_id: string | null;
  due_date: string | null;
  priority: string;
  assigned_to: string | null;
  result?: "ok" | string;
};

const MAX_MB = 10;
const NONE = "__none__";
const stripText = (s: string) => s.replace(/<[^>]*>/g, "").trim();

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

export function ImportDemandsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { boards, selectedBoardId } = useSelectedBoard();
  const [boardId, setBoardId] = useState<string | null>(selectedBoardId);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: services } = useBoardServices(boardId);
  const { data: members } = useBoardMembers(boardId);
  const { data: statuses } = useBoardStatuses(boardId);
  const createDemand = useCreateDemand();
  const board = boards?.find((b) => b.id === boardId);
  const hasServices = (services?.length ?? 0) > 0;

  const reset = () => {
    setStep("upload"); setRows([]); setFile(null); setProgress(0);
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
      const list: Row[] = (data?.demands ?? []).map((d: any, i: number) => ({ ...d, key: `${Date.now()}-${i}` }));
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
    return null;
  };

  const invalid = rows.some((r) => rowError(r));

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
        if (demand?.id && r.assigned_to) {
          await supabase.from("demand_assignees").insert({ demand_id: demand.id, user_id: r.assigned_to, is_primary: true } as any);
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-4xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar demandas de documento</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Envie um PDF, Word, planilha ou texto. A IA identifica as demandas para você revisar."}
            {step === "review" && `${rows.length} demandas encontradas — revise antes de criar.`}
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
              className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files?.[0] ?? null); }}
            >
              <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm">{file ? file.name : <>Arraste o arquivo ou <span className="text-primary">clique para selecionar</span></>}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, CSV, TXT ou MD — até {MAX_MB} MB</p>
            </label>
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
            <ScrollArea className="flex-1 min-h-0 pr-3">
              <div className="space-y-3">
                {rows.map((r, idx) => {
                  const err = rowError(r);
                  return (
                    <div key={r.key} className={`rounded-lg border p-3 space-y-2 ${step === "review" && err ? "border-destructive/60" : "border-border"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                        <Input value={r.title} disabled={step === "done"} placeholder="Título"
                          onChange={(e) => update(r.key, { title: e.target.value })} />
                        {step === "review" ? (
                          <Button variant="ghost" size="icon" disabled={busy} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : r.result === "ok" ? (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                        )}
                      </div>
                      <Textarea rows={2} value={r.description} disabled={step === "done"} placeholder="Descrição"
                        onChange={(e) => update(r.key, { description: e.target.value })} />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Select disabled={step === "done"} value={r.service_id ?? NONE} onValueChange={(v) => update(r.key, { service_id: v === NONE ? null : v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Serviço" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Sem serviço</SelectItem>
                            {services?.map((s: any) => s.service && <SelectItem key={s.service.id} value={s.service.id}>{s.service.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="date" className="h-8 text-xs" disabled={step === "done"} value={r.due_date ?? ""}
                          onChange={(e) => update(r.key, { due_date: e.target.value || null })} />
                        <Select disabled={step === "done"} value={r.priority} onValueChange={(v) => update(r.key, { priority: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["baixa", "média", "alta", "urgente"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select disabled={step === "done"} value={r.assigned_to ?? NONE} onValueChange={(v) => update(r.key, { assigned_to: v === NONE ? null : v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Sem responsável</SelectItem>
                            {members?.filter((m) => m.role !== "requester").map((m) => (
                              <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? "—"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {step === "review" && err && <p className="text-xs text-destructive">{err}</p>}
                      {step === "done" && r.result && r.result !== "ok" && <p className="text-xs text-destructive">{r.result}</p>}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              {step === "review" ? (
                <>
                  <Button variant="outline" size="sm" disabled={busy || rows.length >= 50}
                    onClick={() => setRows([...rows, { key: `${Date.now()}`, title: "", description: "", service_id: null, due_date: null, priority: "média", assigned_to: null }])}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar linha
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled={busy} onClick={reset}>Voltar</Button>
                    <Button onClick={createAll} disabled={busy || invalid || !rows.length}>
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
