import { useParams } from "react-router-dom";
import { useSharedNote } from "@/hooks/useShareNote";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Lock } from "lucide-react";
import DOMPurify from "dompurify";
import { SEOHead } from "@/components/SEOHead";

export default function SharedNote() {
  const { token } = useParams();
  const { data: note, isLoading, error } = useSharedNote(token || null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Nota não encontrada</h1>
          <p className="text-muted-foreground max-w-md">
            Este link de compartilhamento pode ter expirado ou sido revogado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={note.title || "Nota Compartilhada"} />
      {/* Cover Image */}
      <div className="h-40 w-full">
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

      {/* Header Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Nota compartilhada</span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={note.profiles?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {note.profiles?.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {note.profiles?.full_name}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Title Section */}
        <div className="mb-8 pb-6 border-b border-border/50">
          <div className="flex items-start gap-3">
            <span className="text-5xl">{note.icon || "📝"}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
                {note.title || "Sem título"}
              </h1>
              
              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {note.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              <p className="text-sm text-muted-foreground mt-3">
                Atualizado {formatDistanceToNow(new Date(note.updated_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Note Content */}
        {note.content ? (
          <div 
            className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(note.content) 
            }}
          />
        ) : (
          <p className="text-muted-foreground italic">Esta nota está vazia.</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t mt-16">
        <div className="container max-w-4xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Nota compartilhada via Soma</p>
        </div>
      </div>
    </div>
  );
}
