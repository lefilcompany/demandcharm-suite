import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, Bot, Download, Eye, FileText, FolderOpen, GitBranch, MoreHorizontal, Pencil, Plus, RefreshCw, Scale, Search, Trash2, Upload, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { ADR_STATUS_LABEL, ADR_TEMPLATE_HTML, ARTIFACT_KIND_LABEL, canEditArtifactContent, canManageArtifacts, formatAdrNumber, type ArtifactKind } from "@/lib/artifacts";
import { getArtifactUrl, useBoardArtifacts, useDeleteArtifact, useUpdateArtifactMeta, type BoardArtifact } from "@/hooks/useBoardArtifacts";
import { ArtifactEditorDialog, ArtifactUploadDialog, type EditorDraft, type FolderOption } from "./ArtifactDialogs";

type Folder = "all" | "board" | "templates" | string;
interface Props {
  boardId: string;
  role: string | null | undefined;
  sprints: { id: string; name: string }[];
  demands: { id: string; board_sequence_number?: number | null; title: string }[];
  /** Quando definido, mostra só a pasta dessa sprint (aba da sprint). */
  sprintId?: string;
}

const fmtSize = (b?: number | null) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);
const fmtDate = (s: string) => s.substring(0, 10).split("-").reverse().join("/");
const adrVariant: Record<string, string> = {
  proposed: "bg-secondary text-secondary-foreground", accepted: "bg-primary/15 text-primary",
  superseded: "bg-muted text-muted-foreground line-through", rejected: "bg-destructive/10 text-destructive",
};

export function ArtifactsBrowser({ boardId, role, sprints, demands, sprintId }: Props) {
  const canEdit = canManageArtifacts(role);
  const { data: all = [], isLoading, isError, refetch } = useBoardArtifacts(boardId);
  const del = useDeleteArtifact();
  const meta = useUpdateArtifactMeta();
  const [folder, setFolder] = useState<Folder>(sprintId ?? "all");
  const [kind, setKind] = useState<ArtifactKind | "all">("all");
  const [q, setQ] = useState("");
  const [uploadKind, setUploadKind] = useState<ArtifactKind | null>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [viewing, setViewing] = useState<BoardArtifact | null>(null);
  const [preview, setPreview] = useState<BoardArtifact | null>(null);

  const folders: FolderOption[] = [{ id: null, label: "Geral do quadro" }, ...sprints.map((s) => ({ id: s.id, label: s.name }))];
  const currentSprint = sprintId ?? (folder !== "all" && folder !== "board" && folder !== "templates" ? folder : null);
  const templates = all.filter((a) => a.is_template);
  const byId = useMemo(() => Object.fromEntries(all.map((a) => [a.id, a])), [all]);
  const demandById = useMemo(() => Object.fromEntries(demands.map((d) => [d.id, d])), [demands]);

  const list = all.filter((a) => {
    if (folder === "templates") { if (!a.is_template) return false; }
    else {
      if (a.is_template) return false;
      if (folder === "board" && a.sprint_id) return false;
      if (folder !== "all" && folder !== "board" && a.sprint_id !== folder) return false;
    }
    if (kind !== "all" && a.kind !== kind) return false;
    const term = q.trim().toLowerCase();
    return !term || a.title.toLowerCase().includes(term) || (a.file_name ?? "").toLowerCase().includes(term) || formatAdrNumber(a.adr_number).toLowerCase().includes(term);
  });

  const count = (f: Folder) => all.filter((a) => f === "templates" ? a.is_template : !a.is_template && (f === "all" || (f === "board" ? !a.sprint_id : a.sprint_id === f))).length;

  const newAdr = (supersedes?: BoardArtifact) => {
    const tpl = templates.find((t) => t.kind === "adr" && t.source === "authored");
    setDraft({ kind: "adr", title: "", content: tpl?.content || ADR_TEMPLATE_HTML, sprintId: currentSprint, adrStatus: "proposed", supersedes: supersedes ?? null,
      relatedDemandIds: supersedes?.related_demand_ids });
  };
  const fromTemplate = (t: BoardArtifact) => setDraft({ kind: t.kind === "template" ? "doc" : t.kind, title: t.title, content: t.content ?? "", sprintId: currentSprint, adrStatus: "proposed" });
  const edit = (a: BoardArtifact) => setDraft({ id: a.id, kind: a.kind, title: a.title, content: a.content ?? "", sprintId: a.sprint_id, isTemplate: a.is_template, adrStatus: a.adr_status, adrNumber: a.adr_number, relatedDemandIds: a.related_demand_ids });

  const download = async (a: BoardArtifact) => {
    try { const url = await getArtifactUrl(a, true); if (url) window.open(url, "_blank"); } catch { toast.error("Não foi possível baixar"); }
  };
  const remove = (a: BoardArtifact) => {
    if (!confirm(`Excluir "${a.title}"? Essa ação não pode ser desfeita.`)) return;
    del.mutate(a, { onSuccess: () => toast.success("Artefato excluído"), onError: (e: any) => toast.error(e?.message || "Erro ao excluir") });
  };

  const FolderBtn = ({ f, label, icon: Icon }: { f: Folder; label: string; icon: any }) => (
    <button onClick={() => setFolder(f)}
      className={`w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-left transition-colors ${folder === f ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
      <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count(f)}</span>
    </button>
  );

  return (
    <div className={sprintId ? "" : "grid gap-4 md:grid-cols-[230px_1fr]"}>
      {!sprintId && (
        <nav className="rounded-xl border bg-card p-2 space-y-0.5 h-fit">
          <FolderBtn f="all" label="Todos" icon={FolderOpen} />
          <FolderBtn f="board" label="Geral do quadro" icon={FolderOpen} />
          <FolderBtn f="templates" label="Modelos" icon={LayoutTemplate} />
          {sprints.length > 0 && <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Sprints</p>}
          {sprints.map((s) => <FolderBtn key={s.id} f={s.id} label={s.name} icon={FolderOpen} />)}
        </nav>
      )}

      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou ADR-001" className="pl-9 h-9 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", ...Object.keys(ARTIFACT_KIND_LABEL)] as (ArtifactKind | "all")[]).map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`h-8 px-3 rounded-full border text-xs transition-colors ${kind === k ? "border-primary bg-primary/10 text-primary" : "hover:border-primary"}`}>
                {k === "all" ? "Todos" : ARTIFACT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Adicionar</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>ADR</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => newAdr()}><Scale className="h-4 w-4 mr-2" />Escrever ADR com o modelo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUploadKind("adr")}><Upload className="h-4 w-4 mr-2" />Enviar ADR pronta</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDraft({ kind: "doc", title: "", content: "", sprintId: currentSprint })}><FileText className="h-4 w-4 mr-2" />Escrever documento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUploadKind("doc")}><Upload className="h-4 w-4 mr-2" />Enviar arquivo</DropdownMenuItem>
                {templates.some((t) => t.source === "authored") && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><LayoutTemplate className="h-4 w-4 mr-2" />Criar a partir de modelo</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {templates.filter((t) => t.source === "authored").map((t) => <DropdownMenuItem key={t.id} onClick={() => fromTemplate(t)}>{t.title}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDraft({ kind: "adr", title: "Modelo de ADR", content: templates.find((t) => t.kind === "adr")?.content || ADR_TEMPLATE_HTML, sprintId: null, isTemplate: true })}>
                  <LayoutTemplate className="h-4 w-4 mr-2" />Novo modelo do quadro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isError ? (
          <div className="border rounded-xl p-8 text-center space-y-3">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="text-sm">Não foi possível carregar os artefatos.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-4 w-4" />Tentar novamente</Button>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl">
            <FolderOpen className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-2 font-medium">Nenhum artefato aqui</p>
            <p className="text-sm text-muted-foreground">ADRs, relatórios, listas e modelos da sprint ficam guardados neste espaço.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {list.map((a) => {
              const editable = canEdit && a.source === "authored" && canEditArtifactContent(a);
              const sprintName = sprints.find((s) => s.id === a.sprint_id)?.name;
              const open = () => (a.source === "authored" ? setViewing(a) : setPreview(a));
              return (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                  <button onClick={open} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.kind === "adr" && !a.is_template && <span className="text-xs font-mono text-primary">{formatAdrNumber(a.adr_number)}</span>}
                      <span className="font-medium text-sm truncate">{a.title}</span>
                      {a.adr_status && !a.is_template && <span className={`text-[11px] px-2 py-0.5 rounded-full ${adrVariant[a.adr_status]}`}>{ADR_STATUS_LABEL[a.adr_status]}</span>}
                      {a.auto_generated && <Badge variant="outline" className="gap-1 text-[11px] h-5"><Bot className="h-3 w-3" />Automático</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {ARTIFACT_KIND_LABEL[a.kind]} · {a.source === "upload" ? `${a.file_name} ${fmtSize(a.file_size)}` : "Escrito no SoMA"}
                      {folder === "all" && !sprintId && ` · ${a.is_template ? "Modelo" : sprintName ?? "Geral do quadro"}`} · {fmtDate(a.created_at)}
                      {a.superseded_by && byId[a.superseded_by] && ` · substituída por ${formatAdrNumber(byId[a.superseded_by].adr_number)}`}
                    </p>
                  </button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={open} aria-label="Abrir"><Eye className="h-4 w-4" /></Button>
                  {a.source === "upload" && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => download(a)} aria-label="Baixar"><Download className="h-4 w-4" /></Button>}
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {editable && <DropdownMenuItem onClick={() => edit(a)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>}
                        {a.kind === "adr" && !a.is_template && a.adr_status !== "superseded" && (
                          <DropdownMenuItem onClick={() => newAdr(a)}><GitBranch className="h-4 w-4 mr-2" />Substituir por nova ADR</DropdownMenuItem>
                        )}
                        {a.kind === "adr" && a.source === "upload" && a.adr_status === "proposed" && (
                          <DropdownMenuItem onClick={() => meta.mutate({ id: a.id, adr_status: "accepted" })}>Marcar como aceita</DropdownMenuItem>
                        )}
                        {!a.is_template && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger><FolderOpen className="h-4 w-4 mr-2" />Mover para</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {folders.filter((f) => f.id !== a.sprint_id).map((f) => (
                                <DropdownMenuItem key={f.id ?? "b"} onClick={() => meta.mutate({ id: a.id, sprint_id: f.id }, { onSuccess: () => toast.success(`Movido para ${f.label}`) })}>{f.label}</DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        {a.source === "authored" && !a.is_template && (
                          <DropdownMenuItem onClick={() => setDraft({ kind: a.kind, title: a.title, content: a.content ?? "", sprintId: null, isTemplate: true })}>
                            <LayoutTemplate className="h-4 w-4 mr-2" />Salvar cópia como modelo
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(a)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ArtifactUploadDialog open={!!uploadKind} onClose={() => setUploadKind(null)} boardId={boardId} folders={folders}
        defaultSprintId={currentSprint} defaultKind={uploadKind ?? "doc"} />
      <ArtifactEditorDialog draft={draft} onClose={() => setDraft(null)} boardId={boardId} folders={folders} demands={demands} />

      {viewing && (
        <Dialog open onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {viewing.kind === "adr" && !viewing.is_template && <span className="font-mono text-primary">{formatAdrNumber(viewing.adr_number)}</span>}
                {viewing.title}
                {viewing.adr_status && !viewing.is_template && <span className={`text-xs px-2 py-0.5 rounded-full ${adrVariant[viewing.adr_status]}`}>{ADR_STATUS_LABEL[viewing.adr_status]}</span>}
              </DialogTitle>
            </DialogHeader>
            {viewing.related_demand_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="text-muted-foreground">Demandas:</span>
                {viewing.related_demand_ids.map((id) => demandById[id] && (
                  <Link key={id} to={`/app/demands/${id}`} className="px-2 py-0.5 rounded-full border hover:border-primary">#{demandById[id].board_sequence_number} {demandById[id].title}</Link>
                ))}
              </div>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewing.content ?? "") }} />
            {canEdit && viewing.source === "authored" && canEditArtifactContent(viewing) && (
              <div className="flex justify-end"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => { edit(viewing); setViewing(null); }}><Pencil className="h-4 w-4" />Editar</Button></div>
            )}
          </DialogContent>
        </Dialog>
      )}
      {preview && (
        <DocumentPreviewDialog open onOpenChange={(o) => !o && setPreview(null)} fileName={preview.file_name ?? preview.title}
          fileType={preview.mime_type ?? ""} fileSize={preview.file_size ?? undefined} getUrl={() => getArtifactUrl(preview)} />
      )}
    </div>
  );
}
