import { useState } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useNoteShares, useShareNoteWithUser, useRemoveNoteShare, useUpdateNoteSharePermission } from "@/hooks/useNoteShares";
import { useAuth } from "@/lib/auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Users, UserPlus, Eye, Pencil, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NoteShareManagerProps {
  noteId: string;
  teamId: string;
}

export function NoteShareManager({ noteId, teamId }: NoteShareManagerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { data: teamMembers = [], isLoading: isLoadingMembers } = useTeamMembers(teamId);
  const { data: shares = [] } = useNoteShares(noteId);
  const shareWithUser = useShareNoteWithUser();
  const removeShare = useRemoveNoteShare();
  const updatePermission = useUpdateNoteSharePermission();

  // Filter out the current user and already shared users
  const sharedUserIds = shares.map((s) => s.shared_with_user_id);
  const availableMembers = teamMembers
    .filter((m) => m.user_id !== user?.id)
    .filter((m) => !sharedUserIds.includes(m.user_id))
    .filter((m) => 
      search === "" || 
      m.profile.full_name.toLowerCase().includes(search.toLowerCase())
    );

  const handleShare = (userId: string, permission: 'viewer' | 'editor' = 'viewer') => {
    shareWithUser.mutate({ noteId, userId, permission });
  };

  const handleRemoveShare = (userId: string) => {
    removeShare.mutate({ noteId, userId });
  };

  const handlePermissionChange = (userId: string, permission: 'viewer' | 'editor') => {
    updatePermission.mutate({ noteId, userId, permission });
  };

  const isPending = shareWithUser.isPending || removeShare.isPending || updatePermission.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Users className="h-4 w-4" />
          {shares.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {shares.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-50" align="end">
        <div className="p-3 border-b space-y-2 bg-popover">
          <h4 className="font-medium text-sm">Compartilhar com membros</h4>
          <Input
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Available members to share */}
        <div className="max-h-40 overflow-y-auto bg-popover">
          <div className="p-2">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {search ? "Nenhum membro encontrado" : "Todos os membros já têm acesso"}
              </p>
            ) : (
              <div className="space-y-1">
                {availableMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={member.profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-muted">
                        {member.profile.full_name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.profile.full_name || "Usuário"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleShare(member.user_id, 'viewer')}
                        disabled={isPending}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleShare(member.user_id, 'editor')}
                        disabled={isPending}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Current shares */}
        {shares.length > 0 && (
          <>
            <Separator />
            <div className="p-2 bg-popover">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                Com acesso ({shares.length})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={share.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-muted">
                        {share.profiles?.full_name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate flex-1">
                      {share.profiles?.full_name || "Usuário"}
                    </span>
                    <Select
                      value={share.permission}
                      onValueChange={(value: 'viewer' | 'editor') => 
                        handlePermissionChange(share.shared_with_user_id, value)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer" className="text-xs">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> Ver
                          </span>
                        </SelectItem>
                        <SelectItem value="editor" className="text-xs">
                          <span className="flex items-center gap-1">
                            <Pencil className="h-3 w-3" /> Editar
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveShare(share.shared_with_user_id)}
                      disabled={isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
