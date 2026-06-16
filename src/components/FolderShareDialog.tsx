import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, Users, Eye, Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useShareFolder, useUnshareFolder, useUpdateFolderSharePermission, FolderPermission } from "@/hooks/useDemandFolders";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface FolderShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  teamId: string | null;
  sharedWith: { user_id: string; shared_at: string; permission: FolderPermission }[];
}

interface DraftShare {
  permission: FolderPermission;
}

export function FolderShareDialog({
  open,
  onOpenChange,
  folderId,
  folderName,
  teamId,
  sharedWith,
}: FolderShareDialogProps) {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { data: members } = useTeamMembers(teamId);
  const shareFolder = useShareFolder();
  const unshareFolder = useUnshareFolder();
  const updatePermission = useUpdateFolderSharePermission();
  const [saving, setSaving] = useState(false);

  // Draft state: map of user_id -> permission
  const [draft, setDraft] = useState<Map<string, DraftShare>>(new Map());

  // Sync draft with server data when modal opens
  useEffect(() => {
    if (open) {
      const map = new Map<string, DraftShare>();
      sharedWith.forEach((s) => map.set(s.user_id, { permission: s.permission || "view" }));
      setDraft(map);
    }
  }, [open, sharedWith]);

  const serverMap = useMemo(() => {
    const map = new Map<string, FolderPermission>();
    sharedWith.forEach((s) => map.set(s.user_id, s.permission || "view"));
    return map;
  }, [sharedWith]);

  // Split members into "with access" and "without access"
  const { withAccess, withoutAccess } = useMemo(() => {
    if (!members) return { withAccess: [], withoutAccess: [] };
    const otherMembers = members.filter((m: any) => m.user_id !== user?.id);
    const q = search.toLowerCase().trim();
    const filtered = q
      ? otherMembers.filter((m: any) =>
          m.profile?.full_name?.toLowerCase().includes(q) ||
          m.profile?.email?.toLowerCase().includes(q)
        )
      : otherMembers;

    const yes: any[] = [];
    const no: any[] = [];
    filtered.forEach((m: any) => {
      if (draft.has(m.user_id)) {
        yes.push(m);
      } else {
        no.push(m);
      }
    });
    return { withAccess: yes, withoutAccess: no };
  }, [members, search, user?.id, draft]);

  const handleToggle = (userId: string) => {
    const wasShared = draft.has(userId);
    setDraft((prev) => {
      const next = new Map(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.set(userId, { permission: "view" });
      }
      return next;
    });

    if (!wasShared) {
      const member = members?.find((m: any) => m.user_id === userId);
      if (member) {
        toast.success(
          `${member.profile?.full_name || "Usuário"} foi adicionado ao projeto "${folderName}" com acesso de visualização`
        );
      }
    }
  };

  const handlePermissionChange = (userId: string, permission: FolderPermission) => {
    setDraft((prev) => {
      const next = new Map(prev);
      next.set(userId, { permission });
      return next;
    });

    const member = members?.find((m: any) => m.user_id === userId);
    if (member) {
      const permissionLabel = permission === "edit" ? "edição" : "visualização";
      toast.success(
        `Acesso de ${member.profile?.full_name || "Usuário"} alterado para ${permissionLabel} no projeto "${folderName}"`
      );
    }
  };

  const hasChanges = useMemo(() => {
    if (draft.size !== serverMap.size) return true;
    for (const [uid, d] of draft) {
      if (!serverMap.has(uid)) return true;
      if (serverMap.get(uid) !== d.permission) return true;
    }
    for (const uid of serverMap.keys()) {
      if (!draft.has(uid)) return true;
    }
    return false;
  }, [draft, serverMap]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAdd: { user_id: string; permission: FolderPermission }[] = [];
      const toUpdate: { user_id: string; permission: FolderPermission }[] = [];
      const toRemove: string[] = [];

      // New shares or permission changes
      for (const [uid, d] of draft) {
        if (!serverMap.has(uid)) {
          toAdd.push({ user_id: uid, permission: d.permission });
        } else if (serverMap.get(uid) !== d.permission) {
          toUpdate.push({ user_id: uid, permission: d.permission });
        }
      }

      // Removed shares
      for (const uid of serverMap.keys()) {
        if (!draft.has(uid)) {
          toRemove.push(uid);
        }
      }

      await Promise.all([
        ...toAdd.map((s) =>
          shareFolder.mutateAsync({ folder_id: folderId, user_id: s.user_id, permission: s.permission })
        ),
        ...toUpdate.map((s) =>
          updatePermission.mutateAsync({ folder_id: folderId, user_id: s.user_id, permission: s.permission })
        ),
        ...toRemove.map((uid) =>
          unshareFolder.mutateAsync({ folder_id: folderId, user_id: uid })
        ),
      ]);

      toast.success("Compartilhamento atualizado");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar compartilhamento");
    } finally {
      setSaving(false);
    }
  };

  const renderMember = (m: any) => {
    const isShared = draft.has(m.user_id);
    const currentPermission = draft.get(m.user_id)?.permission || "view";
    const initials = m.profile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

    return (
      <div
        key={m.user_id}
        className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-150 cursor-pointer ${
          isShared
            ? "bg-primary/5 border border-primary/20 hover:border-[#F28705]/60 hover:bg-[#F28705]/5"
            : "border border-transparent hover:border-[#F28705]/50 hover:bg-[#F28705]/5"
        }`}
      >
        <button
          onClick={() => handleToggle(m.user_id)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={m.profile?.avatar_url || ""} />
              <AvatarFallback className="text-xs font-medium bg-muted">
                {initials}
              </AvatarFallback>
            </Avatar>
            {isShared && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground group-hover:text-foreground">{m.profile?.full_name || "Sem nome"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {m.position && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 border"
                  style={{ backgroundColor: m.position.color + "15", borderColor: m.position.color + "40", color: m.position.color }}
                >
                  {m.position.name}
                </Badge>
              )}
            </div>
          </div>
        </button>

        {isShared && (
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Select
              value={currentPermission}
              onValueChange={(v) => handlePermissionChange(m.user_id, v as FolderPermission)}
            >
              <SelectTrigger className="h-7 w-[110px] text-[11px] gap-1 px-2 border-border/60 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    <span>Visualizar</span>
                  </div>
                </SelectItem>
                <SelectItem value="edit">
                  <div className="flex items-center gap-1.5">
                    <Pencil className="h-3 w-3" />
                    <span>Editar</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <button
              onClick={() => handleToggle(m.user_id)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Remover acesso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span>Compartilhar projeto</span>
                <p className="text-sm font-normal text-muted-foreground mt-0.5">{folderName}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-lg"
            />
          </div>

          {draft.size > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary" className="text-xs font-medium">
                {draft.size} {draft.size === 1 ? "pessoa com acesso" : "pessoas com acesso"}
              </Badge>
            </div>
          )}
        </div>

        {/* Member list */}
        <ScrollArea className="h-[280px]">
          <div className="px-3 py-2">
            {/* Users with access */}
            {withAccess.length > 0 && (
              <>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                  Com acesso
                </p>
                <div className="space-y-0.5 mb-2">
                  {withAccess.map(renderMember)}
                </div>
              </>
            )}

            {/* Users without access */}
            {withoutAccess.length > 0 && (
              <>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                  {withAccess.length > 0 ? "Sem acesso" : "Membros da equipe"}
                </p>
                <div className="space-y-0.5">
                  {withoutAccess.map(renderMember)}
                </div>
              </>
            )}

            {withAccess.length === 0 && withoutAccess.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum membro encontrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tente buscar com outro termo</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/40 bg-muted/20">
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Visualizar = somente leitura</span>
            <span className="flex items-center gap-1"><Pencil className="h-3 w-3" /> Editar = gerenciar demandas e nome</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-[#F28705] hover:bg-[#D97706] text-white hover:text-white"
            >
              <Save className="h-4 w-4 mr-1.5 hover:text-white" />
              {saving ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
