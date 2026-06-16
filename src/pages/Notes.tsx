import { useState, useMemo, useCallback } from "react";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";
import { useSharedWithMeNotes, useLeaveSharedNote, SharedNote } from "@/hooks/useNoteShares";
import { NoteCard } from "@/components/notes/NoteCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Loader2, LayoutGrid, List, X, Tag, Users, LogOut, Eye, Pencil, StickyNote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { SEOHead } from "@/components/SEOHead";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Notes() {
  const { data: notes, isLoading } = useNotes();
  const { data: sharedNotes, isLoading: isLoadingShared } = useSharedWithMeNotes();
  const createNote = useCreateNote();
  const leaveNote = useLeaveSharedNote();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [leavingNoteId, setLeavingNoteId] = useState<string | null>(null);
  const [noteToLeave, setNoteToLeave] = useState<{ id: string; title: string } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  // Minhas notas = apenas as que eu criei
  const myNotes = useMemo(() => {
    if (!notes || !user?.id) return [];
    return notes.filter((note) => note.created_by === user.id);
  }, [notes, user?.id]);

  const openLeaveDialog = useCallback((noteId: string, noteTitle: string) => {
    setNoteToLeave({ id: noteId, title: noteTitle });
  }, []);

  const handleConfirmLeave = useCallback(() => {
    if (!noteToLeave) return;
    
    setIsLeaving(true);
    setLeavingNoteId(noteToLeave.id);
    
    // Wait for animation to complete before actually leaving
    setTimeout(() => {
      leaveNote.mutate(noteToLeave.id, {
        onSettled: () => {
          setLeavingNoteId(null);
          setNoteToLeave(null);
          setIsLeaving(false);
        },
      });
    }, 300);
  }, [noteToLeave, leaveNote]);

  // Extract all unique tags from my notes
  const allTags = useMemo(() => {
    if (!myNotes) return [];
    const tagSet = new Set<string>();
    myNotes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [myNotes]);

  const filteredNotes = useMemo(() => {
    if (!myNotes) return [];
    return myNotes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(search.toLowerCase()) ||
        note.content?.toLowerCase().includes(search.toLowerCase());
      
      const matchesTags = 
        selectedTags.length === 0 || 
        selectedTags.every(tag => note.tags?.includes(tag));
      
      return matchesSearch && matchesTags;
    });
  }, [myNotes, search, selectedTags]);

  const filteredSharedNotes = useMemo(() => {
    if (!sharedNotes) return [];
    return sharedNotes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(search.toLowerCase()) ||
        note.content?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [sharedNotes, search]);

  const guardNotes = usePlanLimitGuard("notes");
  const handleCreateNote = async () => {
    const ok = await guardNotes();
    if (!ok) return;
    const note = await createNote.mutateAsync({});
    if (note) {
      navigate(`/notes/${note.id}`);
    }
  };


  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedTags([]);
  };

  const renderNoteGrid = (notesList: typeof filteredNotes, showOwner = false) => (
    <div className={cn(
      viewMode === "grid" 
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
        : "space-y-2"
    )}>
      {viewMode === "grid" ? (
        notesList.map((note) => (
          <div 
            key={note.id} 
            className={cn(
              "relative transition-all duration-300",
              leavingNoteId === note.id && "opacity-0 scale-95 pointer-events-none"
            )}
          >
            <NoteCard 
              note={note} 
              onClick={() => navigate(`/notes/${note.id}`)}
              isShared={showOwner}
              onLeave={showOwner ? () => openLeaveDialog(note.id, note.title) : undefined}
            />
            {showOwner && 'profiles' in note && note.profiles && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                {/* Permission Badge */}
                {'permission' in note && (
                  <Badge 
                    variant={(note as SharedNote).permission === 'editor' ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0 font-normal flex items-center gap-1"
                  >
                    {(note as SharedNote).permission === 'editor' ? (
                      <>
                        <Pencil className="h-2.5 w-2.5" />
                        Editor
                      </>
                    ) : (
                      <>
                        <Eye className="h-2.5 w-2.5" />
                        Visualizador
                      </>
                    )}
                  </Badge>
                )}
                {/* Owner Info */}
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-2 py-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={note.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {note.profiles.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] text-muted-foreground">
                    {note.profiles.full_name?.split(" ")[0]}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))
      ) : (
        notesList.map((note) => (
          <div
            key={note.id}
            onClick={() => navigate(`/notes/${note.id}`)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all duration-300",
              leavingNoteId === note.id && "opacity-0 scale-95 pointer-events-none"
            )}
          >
            <span className="text-2xl">{note.icon || "📝"}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{note.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">
                  Atualizado {new Date(note.updated_at).toLocaleDateString("pt-BR")}
                </p>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex gap-1">
                    {note.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                        {tag}
                      </Badge>
                    ))}
                    {note.tags.length > 2 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        +{note.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            {showOwner && 'profiles' in note && (
              <div className="flex items-center gap-2">
                {/* Permission Badge */}
                {'permission' in note && (
                  <Badge 
                    variant={(note as SharedNote).permission === 'editor' ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0 font-normal flex items-center gap-1"
                  >
                    {(note as SharedNote).permission === 'editor' ? (
                      <>
                        <Pencil className="h-2.5 w-2.5" />
                        Editor
                      </>
                    ) : (
                      <>
                        <Eye className="h-2.5 w-2.5" />
                        Visualizador
                      </>
                    )}
                  </Badge>
                )}
                {/* Owner Info */}
                {note.profiles && (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={note.profiles.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {note.profiles.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {note.profiles.full_name?.split(" ")[0]}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <SEOHead title="Notas" path="/notes" />
      <PageBreadcrumb 
        items={[
          { label: "Soma Notes", href: "/notes", icon: StickyNote }
        ]} 
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Soma Notes
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie e organize suas anotações de forma simples
          </p>
        </div>
        
        <Button onClick={handleCreateNote} disabled={createNote.isPending}>
          {createNote.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Nova Nota
        </Button>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar notas..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center border rounded-lg p-1">
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {allTags.map(tag => (
              <Badge 
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer text-xs font-normal transition-colors"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
            {(selectedTags.length > 0 || search) && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
                onClick={clearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* My Notes Section */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Minhas Notas
        </h2>

        {isLoading ? (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
              : "space-y-2"
          )}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className={viewMode === "grid" ? "h-48" : "h-20"} />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">
              {search || selectedTags.length > 0 ? "Nenhuma nota encontrada" : "Nenhuma nota ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-3 max-w-sm">
              {search || selectedTags.length > 0
                ? "Tente buscar por outros termos ou remover os filtros" 
                : "Crie sua primeira nota para começar"
              }
            </p>
            {!search && selectedTags.length === 0 && (
              <Button size="sm" onClick={handleCreateNote} disabled={createNote.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira nota
              </Button>
            )}
          </div>
        ) : (
          renderNoteGrid(filteredNotes)
        )}
      </div>

      {/* Shared With Me Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Compartilhadas Comigo
        </h2>

        {isLoadingShared ? (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
              : "space-y-2"
          )}>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className={viewMode === "grid" ? "h-48" : "h-20"} />
            ))}
          </div>
        ) : filteredSharedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">
              {search ? "Nenhuma nota compartilhada encontrada" : "Nenhuma nota compartilhada"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search
                ? "Tente buscar por outros termos"
                : "Quando alguém compartilhar uma nota com você, ela aparecerá aqui"
              }
            </p>
          </div>
        ) : (
          renderNoteGrid(filteredSharedNotes, true)
        )}
      </div>

      {/* Leave Shared Note Dialog */}
      <AlertDialog open={!!noteToLeave} onOpenChange={(open) => !open && setNoteToLeave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Sair da nota compartilhada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a sair da nota <span className="font-medium text-foreground">"{noteToLeave?.title}"</span>. 
              Você perderá o acesso a esta nota e ela será removida da sua lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmLeave}
              disabled={isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saindo...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair da nota
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
