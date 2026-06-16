import { useParams, useNavigate } from "react-router-dom";
import { useNote, useUpdateNote, useDeleteNote } from "@/hooks/useNotes";
import { useNotePermission, useLeaveSharedNote } from "@/hooks/useNoteShares";
import { NotionEditor } from "@/components/notes/NotionEditor";
import { NoteIconPicker } from "@/components/notes/NoteIconPicker";
import { NoteTagManager } from "@/components/notes/NoteTagManager";
import { ShareNoteButton } from "@/components/notes/ShareNoteButton";
import { NoteShareManager } from "@/components/notes/NoteShareManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MoreHorizontal, 
  Trash2, 
  Archive,
  Image,
  Loader2,
  Eye,
  LogOut
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { debounce } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { extractMentionedUserIdsFromHtml } from "@/lib/mentionUtils";
import { sendMentionPushNotification } from "@/hooks/useSendPushNotification";

export default function NoteDetail() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: note, isLoading } = useNote(noteId || null);
  const { data: permission } = useNotePermission(noteId || null);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const leaveNote = useLeaveSharedNote();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("📝");
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const isOwner = permission === 'owner';
  const canEdit = permission === 'owner' || permission === 'editor';
  const isViewer = permission === 'viewer';
  
  const coverInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const notifiedMentionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || "");
      setIcon(note.icon || "📝");
      setTags(note.tags || []);
      // Initialize already-mentioned users so we don't re-notify on load
      const existingMentions = extractMentionedUserIdsFromHtml(note.content || "");
      notifiedMentionsRef.current = new Set(existingMentions);
    }
  }, [note]);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.style.height = "auto";
      titleInputRef.current.style.height = titleInputRef.current.scrollHeight + "px";
    }
  }, [title]);

  // Debounced save
  const debouncedSave = useCallback(
    debounce((noteId: string, data: { title?: string; content?: string; icon?: string }) => {
      setIsSaving(true);
      updateNote.mutate(
        { noteId, ...data },
        {
          onSettled: () => setIsSaving(false),
        }
      );
    }, 1000),
    []
  );

  const handleTitleChange = (newTitle: string) => {
    if (!canEdit) return;
    setTitle(newTitle);
    if (noteId) {
      debouncedSave(noteId, { title: newTitle });
    }
  };

  const handleContentChange = (newContent: string) => {
    if (!canEdit) return;
    setContent(newContent);
    if (noteId) {
      debouncedSave(noteId, { content: newContent });

      // Check for new mentions and notify
      const currentMentions = extractMentionedUserIdsFromHtml(newContent);
      const newMentions = currentMentions.filter(
        (id) => id !== user?.id && !notifiedMentionsRef.current.has(id)
      );
      if (newMentions.length > 0 && user?.id) {
        newMentions.forEach((id) => notifiedMentionsRef.current.add(id));
        (async () => {
          try {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
            const mentionerName = profile?.full_name || "Alguém";
            const noteTitle = title || "Sem título";
            const mentionNotifs = newMentions.map((uid) => ({
              user_id: uid,
              title: "Você foi mencionado",
              message: `${mentionerName} mencionou você na nota "${noteTitle}"`,
              type: "mention",
              link: `/notes/${noteId}`,
            }));
            await supabase.from("notifications").insert(mentionNotifs);
            for (const uid of newMentions) {
              sendMentionPushNotification({
                mentionedUserId: uid,
                demandId: noteId!,
                demandTitle: noteTitle,
                mentionerName,
              }).catch(console.error);
            }
          } catch (err) {
            console.error("Error sending note mention notifications:", err);
          }
        })();
      }
    }
  };

  const handleIconChange = (newIcon: string) => {
    if (!canEdit) return;
    setIcon(newIcon);
    if (noteId) {
      updateNote.mutate({ noteId, icon: newIcon });
    }
  };

  const handleDelete = () => {
    if (confirm("Tem certeza que deseja excluir esta nota?")) {
      deleteNote.mutate(noteId!, {
        onSuccess: () => navigate("/notes"),
      });
    }
  };

  const handleArchive = () => {
    if (noteId) {
      updateNote.mutate(
        { noteId, archived: true },
        { onSuccess: () => navigate("/notes") }
      );
    }
  };
  const handleLeaveNote = () => {
    if (confirm("Tem certeza que deseja sair desta nota compartilhada?")) {
      leaveNote.mutate(noteId!, {
        onSuccess: () => navigate("/notes"),
      });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !noteId) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inline-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("inline-images")
        .getPublicUrl(filePath);

      updateNote.mutate({ noteId, cover_url: publicUrl });
      toast.success("Capa atualizada!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da capa");
    }
    e.target.value = "";
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Focus the editor
      const editorElement = document.querySelector(".ProseMirror");
      if (editorElement instanceof HTMLElement) {
        editorElement.focus();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6 text-center">
        <p className="text-muted-foreground">Nota não encontrada</p>
        <Button variant="link" onClick={() => navigate("/notes")}>
          Voltar para notas
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={note.title || "Nota sem título"} />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      {/* Cover Image */}
      {note.cover_url && (
        <div className="h-48 w-full relative group">
          <img 
            src={note.cover_url} 
            alt="" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => coverInputRef.current?.click()}
            >
              Alterar capa
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/notes")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-center gap-2">
            {isViewer && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Somente leitura
              </Badge>
            )}
            
            {isSaving && canEdit && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando...
              </span>
            )}

            {isOwner && (
              <>
                <NoteShareManager noteId={noteId!} teamId={note.team_id} />
                <ShareNoteButton noteId={noteId!} />
              </>
            )}

            {canEdit && <NoteTagManager
              tags={tags} 
              onTagsChange={(newTags) => {
                setTags(newTags);
                if (noteId) {
                  updateNote.mutate({ noteId, tags: newTags });
                }
              }} 
            />}

            {canEdit && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => coverInputRef.current?.click()}>
                  <Image className="h-4 w-4 mr-2" />
                  {note.cover_url ? "Alterar capa" : "Adicionar capa"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}

            {/* Leave button for non-owners */}
            {!isOwner && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLeaveNote}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Title Section - Highlighted and Separated */}
        <div className="mb-8 pb-6 border-b border-border/50">
          <div className="flex items-start gap-3">
            {canEdit ? (
              <NoteIconPicker value={icon} onChange={handleIconChange} />
            ) : (
              <span className="text-4xl">{icon}</span>
            )}
            <div className="flex-1 min-w-0">
              {canEdit ? (
                <textarea
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Sem título"
                  rows={1}
                  className="w-full text-4xl sm:text-5xl font-bold bg-transparent border-none outline-none resize-none overflow-hidden placeholder:text-muted-foreground/50 leading-tight"
                  style={{ minHeight: "1.2em" }}
                />
              ) : (
                <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
                  {title || "Sem título"}
                </h1>
              )}
              
              {/* Tags display */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              {canEdit && (
                <p className="text-sm text-muted-foreground mt-3">
                  Pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> para começar a escrever, 
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono mx-1">/</kbd> para comandos,
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono mx-1">@</kbd> mencionar pessoa,
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono mx-1">#</kbd> mencionar demanda
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Editor */}
        <NotionEditor 
          content={content}
          onChange={handleContentChange}
          placeholder={canEdit ? "Comece a escrever aqui..." : ""}
          editable={canEdit}
        />
      </div>
    </div>
  );
}
