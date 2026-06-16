import { Note } from "@/hooks/useNotes";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Trash2, Archive, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDeleteNote, useUpdateNote } from "@/hooks/useNotes";
import { useLeaveSharedNote } from "@/hooks/useNoteShares";
import { useAuth } from "@/lib/auth";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  isShared?: boolean;
  onLeave?: () => void;
}

export function NoteCard({ note, onClick, isShared = false, onLeave }: NoteCardProps) {
  const deleteNote = useDeleteNote();
  const updateNote = useUpdateNote();
  const leaveNote = useLeaveSharedNote();
  const { user } = useAuth();

  const isOwner = note.created_by === user?.id;
  const showMenu = isOwner || isShared;

  // Extract plain text preview from HTML content using DOMParser (safer than innerHTML)
  const getPreview = (html: string | null) => {
    if (!html) return "Nota vazia...";
    // Use DOMParser which is safer than creating elements with innerHTML
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = doc.body.textContent || "";
    return text.slice(0, 150) + (text.length > 150 ? "..." : "");
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNote.mutate({ noteId: note.id, archived: true });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir esta nota?")) {
      deleteNote.mutate(note.id);
    }
  };

  const handleLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLeave) {
      onLeave();
    } else if (confirm("Tem certeza que deseja sair desta nota compartilhada?")) {
      leaveNote.mutate(note.id);
    }
  };

  return (
    <Card 
      className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 bg-card overflow-hidden"
      onClick={onClick}
    >
      <div className="h-16 overflow-hidden">
        {note.cover_url ? (
          <img 
            src={note.cover_url} 
            alt="" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20" />
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl flex-shrink-0">{note.icon || "📝"}</span>
            <h3 className="font-semibold text-foreground truncate">
              {note.title || "Sem título"}
            </h3>
          </div>
          {showMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner ? (
                  <>
                    <DropdownMenuItem onClick={handleArchive}>
                      <Archive className="h-4 w-4 mr-2" />
                      Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                ) : isShared ? (
                  <DropdownMenuItem onClick={handleLeave} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair da nota
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {getPreview(note.content)}
        </p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {note.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                {tag}
              </Badge>
            ))}
            {note.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                +{note.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={note.profiles?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {note.profiles?.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {note.profiles?.full_name}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(note.updated_at), { 
              addSuffix: true, 
              locale: ptBR 
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
