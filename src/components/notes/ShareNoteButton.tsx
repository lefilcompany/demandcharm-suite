import { useState } from "react";
import { Share2, Copy, Check, Link2, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { 
  useNoteShareToken, 
  useCreateNoteShareToken, 
  useRevokeNoteShareToken 
} from "@/hooks/useShareNote";
import { cn } from "@/lib/utils";

interface ShareNoteButtonProps {
  noteId: string;
}

export function ShareNoteButton({ noteId }: ShareNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { data: shareToken, isLoading } = useNoteShareToken(noteId);
  const createToken = useCreateNoteShareToken();
  const revokeToken = useRevokeNoteShareToken();

  const shareUrl = shareToken 
    ? `${window.location.origin}/shared/note/${shareToken.token}`
    : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateLink = () => {
    createToken.mutate(noteId);
  };

  const handleRevokeLink = () => {
    if (shareToken) {
      revokeToken.mutate({ tokenId: shareToken.id, noteId });
    }
  };

  const isPending = createToken.isPending || revokeToken.isPending;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(shareToken && "text-primary")}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Compartilhar nota</h4>
            {shareToken && (
              <span className="text-xs text-primary flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Ativo
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : shareToken ? (
            <>
              <div className="flex gap-2">
                <Input
                  value={shareUrl || ""}
                  readOnly
                  className="text-xs h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Qualquer pessoa com este link pode visualizar esta nota, mesmo sem estar logado.
              </p>

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleRevokeLink}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2Off className="h-4 w-4 mr-2" />
                )}
                Revogar acesso
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Crie um link público para compartilhar esta nota com qualquer pessoa.
              </p>
              
              <Button
                className="w-full"
                onClick={handleCreateLink}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Criar link de compartilhamento
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
