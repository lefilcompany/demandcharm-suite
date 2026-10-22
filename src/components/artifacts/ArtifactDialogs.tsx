import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { ADR_STATUS_LABEL, ARTIFACT_KIND_LABEL, ARTIFACT_MAX_BYTES, formatAdrNumber, type AdrStatus, type ArtifactKind } from "@/lib/artifacts";
import { useSaveAuthoredArtifact, useUploadArtifact, type BoardArtifact } from "@/hooks/useBoardArtifacts";

export interface FolderOption { id: string | null; label: string }
type DemandRef = { id: string; board_sequence_number?: number | null; title: string };

const KINDS = Object.keys(ARTIFACT_KIND_LABEL) as ArtifactKind[];

function FolderSelect({ value, onChange, folders }: { value: string | null; onChange: (v: string | null) => void; folders: FolderOption[] }) {
  return (
    <Select value={value ?? "__board"} onValueChange={(v) => onChange(v === "__board" ? null : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {folders.map((f) => <SelectItem key={f.id ?? "__board"} value={f.id ?? "__board"}>{f.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ArtifactUploadDialog({ open, onClose, boardId, folders, defaultSprintId, defaultKind = "doc" }: {
  open: boolean; onClose: () => void; boardId: string; folders: FolderOption[]; defaultSprintId: string | null; defaultKind?: ArtifactKind;
}) {
  const upload = useUploadArtifact();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ArtifactKind>(defaultKind);
  const [sprintId, setSprintId] = useState<string | null>(defaultSprintId);
  const [isTemplate, setIsTemplate] = useState(false);
  useEffect(() => { if (open) { setFile(null); setTitle(""); setKind(defaultKind); setSprintId(defaultSprintId); setIsTemplate(false); } }, [open, defaultKind, defaultSprintId]);

  const submit = () => {
    if (!file) return;
    upload.mutate({ boardId, sprintId: isTemplate ? null : sprintId, kind, title: title || file.name, file, fileName: file.name, isTemplate }, {
      onSuccess: () => { toast.success("Arquivo guardado"); onClose(); },
      onError: (e: any) => toast.error(e?.message || "Não foi possível enviar"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar arquivo</DialogTitle>
          <DialogDescription>PDF, Word, Excel, imagens ou Markdown, até 20 MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-primary transition-colors">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-center">{file ? file.name : "Clique para escolher o arquivo"}</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.md,.txt,.png,.jpg,.jpeg,.webp,.ppt,.pptx"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > ARTIFACT_MAX_BYTES) { toast.error("Arquivo maior que 20 MB"); return; }
                setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }} />
          </label>
          <div className="space-y-1"><Label>Nome</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ArtifactKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{ARTIFACT_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Pasta</Label><FolderSelect value={isTemplate ? null : sprintId} onChange={setSprintId} folders={folders} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={isTemplate} onCheckedChange={(v) => setIsTemplate(!!v)} />Guardar como modelo do quadro</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!file || upload.isPending}>{upload.isPending ? "Enviando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface EditorDraft {
  id?: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  sprintId: string | null;
  isTemplate?: boolean;
  adrStatus?: AdrStatus | null;
  adrNumber?: number | null;
  relatedDemandIds?: string[];
  supersedes?: BoardArtifact | null;
}

export function ArtifactEditorDialog({ draft, onClose, boardId, folders, demands }: {
  draft: EditorDraft | null; onClose: () => void; boardId: string; folders: FolderOption[]; demands: DemandRef[];
}) {
  const save = useSaveAuthoredArtifact();
  const [d, setD] = useState<EditorDraft | null>(draft);
  const [refs, setRefs] = useState("");
  useEffect(() => {
    setD(draft);
    const nums = (draft?.relatedDemandIds ?? []).map((id) => demands.find((x) => x.id === id)?.board_sequence_number).filter(Boolean);
    setRefs(nums.map((n) => `#${n}`).join(", "));
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const isAdr = d.kind === "adr" && !d.isTemplate;

  const submit = () => {
    if (!d.title.trim()) { toast.error("Dê um nome ao documento"); return; }
    const nums = [...refs.matchAll(/\d+/g)].map((m) => Number(m[0]));
    const missing = nums.filter((n) => !demands.some((x) => x.board_sequence_number === n));
    if (missing.length) { toast.error(`Demanda(s) não encontrada(s) neste quadro: #${missing.join(", #")}`); return; }
    const relatedDemandIds = demands.filter((x) => x.board_sequence_number && nums.includes(x.board_sequence_number)).map((x) => x.id);
    save.mutate({
      id: d.id, boardId, sprintId: d.isTemplate ? null : d.sprintId, kind: d.kind, title: d.title, content: d.content,
      isTemplate: d.isTemplate, adrStatus: d.adrStatus, relatedDemandIds, supersedes: d.supersedes?.id ?? null,
    }, {
      onSuccess: () => { toast.success("Documento salvo"); onClose(); },
      onError: (e: any) => toast.error(e?.message || "Não foi possível salvar"),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAdr ? (d.id ? `${formatAdrNumber(d.adrNumber)} · editar` : "Nova ADR") : d.isTemplate ? "Modelo do quadro" : d.id ? "Editar documento" : "Novo documento"}
          </DialogTitle>
          {d.supersedes && <DialogDescription>Esta ADR vai substituir {formatAdrNumber(d.supersedes.adr_number)} — {d.supersedes.title}.</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>{isAdr ? "Título da decisão" : "Nome"}</Label>
            <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={150} placeholder={isAdr ? "Ex.: Usar fila para envio de e-mails" : ""} autoFocus />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={d.kind} onValueChange={(v) => setD({ ...d, kind: v as ArtifactKind })} disabled={!!d.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{ARTIFACT_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!d.isTemplate && <div className="space-y-1"><Label>Pasta</Label><FolderSelect value={d.sprintId} onChange={(v) => setD({ ...d, sprintId: v })} folders={folders} /></div>}
            {isAdr && (
              <div className="space-y-1"><Label>Situação</Label>
                <Select value={d.adrStatus ?? "proposed"} onValueChange={(v) => setD({ ...d, adrStatus: v as AdrStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["proposed", "accepted", "rejected"] as AdrStatus[]).map((s) => <SelectItem key={s} value={s}>{ADR_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {isAdr && d.adrStatus === "accepted" && (
            <p className="text-xs text-muted-foreground">Depois de salva como "Aceita", a ADR não pode mais ser editada. Para mudar a decisão, crie uma nova que a substitua.</p>
          )}
          {!d.isTemplate && (
            <div className="space-y-1"><Label>Demandas relacionadas</Label>
              <Input value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="Ex.: #12, #45" />
            </div>
          )}
          <RichTextEditor value={d.content} onChange={(html) => setD({ ...d, content: html })} minHeight="320px" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
