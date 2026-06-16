import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Plus, MoreVertical, Pencil, Trash2, ListChecks, Users, Share2 } from "lucide-react";
import { useDemandFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, DemandFolder } from "@/hooks/useDemandFolders";
import { useAuth } from "@/lib/auth";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { FolderDemandManager } from "@/components/FolderDemandManager";
import { FolderShareDialog } from "@/components/FolderShareDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DemandFolderStripProps {
  teamId: string | null;
  selectedFolderId?: string | null;
  onSelectFolder?: (folderId: string | null) => void;
}

export function DemandFolderStrip({ teamId, selectedFolderId, onSelectFolder }: DemandFolderStripProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: folders } = useDemandFolders(teamId, user?.id);
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DemandFolder | null>(null);
  const [managingFolder, setManagingFolder] = useState<DemandFolder | null>(null);
  const [sharingFolder, setSharingFolder] = useState<DemandFolder | null>(null);

  const handleCreate = (name: string, color: string) => {
    if (!teamId || !user?.id) return;
    createFolder.mutate({ name, color, team_id: teamId, created_by: user.id });
  };

  const handleEdit = (name: string, color: string) => {
    if (!editingFolder) return;
    updateFolder.mutate({ id: editingFolder.id, name, color });
    setEditingFolder(null);
  };

  const handleDelete = (folder: DemandFolder) => {
    if (selectedFolderId === folder.id) {
      onSelectFolder?.(null);
    } else {
      onSelectFolder?.(folder.id);
    }
    deleteFolder.mutate(folder.id);
  };

  const handleFolderClick = (folder: DemandFolder) => {
    navigate(`/folders/${folder.id}`);
  };

  return (
    <>
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
        {folders?.map((folder) => {
          const isOwner = folder.is_owner;
          const isShared = !isOwner;
          const hasShares = (folder.shared_with?.length || 0) > 0;
          const myShare = !isOwner
            ? folder.shared_with?.find((s) => s.user_id === user?.id)
            : undefined;
          const canEdit = isOwner || myShare?.permission === "edit";

          return (
            <div
              key={folder.id}
              onClick={() => handleFolderClick(folder)}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-200 shrink-0 min-w-[140px] max-w-[200px]",
                "bg-muted/40 hover:bg-muted/70",
                selectedFolderId === folder.id
                  ? "ring-2 ring-primary border-primary/40 bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <FolderOpen
                className="h-5 w-5 shrink-0"
                style={{ color: folder.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-medium truncate text-foreground">{folder.name}</p>
                  {isShared && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Share2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Compartilhada com você</TooltipContent>
                    </Tooltip>
                  )}
                  {isOwner && hasShares && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent>Compartilhada com {folder.shared_with!.length} pessoa(s)</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {folder.item_count || 0} {folder.item_count === 1 ? "demanda" : "demandas"}
                </p>
              </div>

              {/* Context menu - only for owners, shared users get limited menu */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background/80"
                >
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEdit && (
                    <>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setManagingFolder(folder); }}>
                        <ListChecks className="h-4 w-4 mr-2" />
                        Gerenciar demandas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSharingFolder(folder); }}>
                        <Users className="h-4 w-4 mr-2" />
                        Compartilhar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Renomear
                      </DropdownMenuItem>
                      {isOwner && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                  {!canEdit && (
                    <DropdownMenuItem
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground"
                      disabled
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Compartilhada com você
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {/* Create folder card */}
        <button
          onClick={() => setCreateOpen(true)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 shrink-0 min-w-[140px]",
            "border-border/60 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary"
          )}
        >
          <div className="flex items-center justify-center h-5 w-5 shrink-0">
            <Plus className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium whitespace-nowrap">
            {(!folders || folders.length === 0) ? "Criar projeto" : "Novo projeto"}
          </span>
        </button>
      </div>

      {/* Dialogs */}
      <CreateFolderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={handleCreate}
      />

      {editingFolder && (
        <CreateFolderDialog
          open={!!editingFolder}
          onOpenChange={(open) => !open && setEditingFolder(null)}
          onConfirm={handleEdit}
          initialName={editingFolder.name}
          initialColor={editingFolder.color}
          isEditing
        />
      )}

      {managingFolder && (
        <FolderDemandManager
          open={!!managingFolder}
          onOpenChange={(open) => !open && setManagingFolder(null)}
          folderId={managingFolder.id}
          folderName={managingFolder.name}
          teamId={teamId}
        />
      )}

      {sharingFolder && (
        <FolderShareDialog
          open={!!sharingFolder}
          onOpenChange={(open) => !open && setSharingFolder(null)}
          folderId={sharingFolder.id}
          folderName={sharingFolder.name}
          teamId={teamId}
          sharedWith={sharingFolder.shared_with || []}
        />
      )}
    </>
  );
}
