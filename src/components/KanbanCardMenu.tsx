import { useState } from "react";
import { MoreVertical, ExternalLink, Share2, FolderOpen, Archive, Pencil, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useDemandFolders, useAddDemandToFolder, useRemoveDemandFromFolder } from "@/hooks/useDemandFolders";
import { useUpdateDemand } from "@/hooks/useDemands";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { ShareDemandDialog } from "@/components/ShareDemandDialog";
import { DependencyMenuItems } from "@/components/DependencyMenuItems";
import { useNavigate } from "react-router-dom";

interface KanbanCardMenuProps {
  demandId: string;
  teamId?: string;
  boardId?: string;
  isDelivered?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  onDemandClick: (id: string) => void;
}

export function KanbanCardMenu({ demandId, teamId, boardId, isDelivered, readOnly, compact, onDemandClick }: KanbanCardMenuProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateDemand = useUpdateDemand();
  const [folderOpen, setFolderOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { data: allFolders } = useDemandFolders(teamId || null, user?.id);
  const addToFolder = useAddDemandToFolder();
  const removeFromFolder = useRemoveDemandFromFolder();
  const [linkedFolderIds, setLinkedFolderIds] = useState<Set<string>>(new Set());
  const [loadedLinks, setLoadedLinks] = useState(false);

  const loadFolderLinks = async () => {
    if (loadedLinks) return;
    const { data } = await supabase
      .from("project_demands")
      .select("project_id")
      .eq("demand_id", demandId);
    setLinkedFolderIds(new Set((data || []).map((d: any) => d.project_id)));
    setLoadedLinks(true);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareOpen(true);
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    updateDemand.mutate({
      id: demandId,
      archived: true,
      archived_at: new Date().toISOString(),
    }, {
      onSuccess: () => {
        toast.success("Demanda arquivada!");
        queryClient.invalidateQueries({ queryKey: ["demands"] });
      },
    });
  };

  const handleToggleFolder = async (folderId: string) => {
    const isLinked = linkedFolderIds.has(folderId);
    if (isLinked) {
      removeFromFolder.mutate({ folder_id: folderId, demand_id: demandId }, {
        onSuccess: () => {
          setLinkedFolderIds(prev => { const s = new Set(prev); s.delete(folderId); return s; });
          queryClient.invalidateQueries({ queryKey: ["demand-folder-links", demandId] });
          queryClient.invalidateQueries({ queryKey: ["demand-folders"] });
        }
      });
    } else {
      addToFolder.mutate({ folder_id: folderId, demand_id: demandId }, {
        onSuccess: () => {
          setLinkedFolderIds(prev => new Set(prev).add(folderId));
          queryClient.invalidateQueries({ queryKey: ["demand-folder-links", demandId] });
          queryClient.invalidateQueries({ queryKey: ["demand-folders"] });
          toast.success("Vinculada à pasta!");
        }
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10",
              compact ? "h-6 w-6" : "h-7 w-7",
              "bg-background/80 hover:bg-muted backdrop-blur-sm shadow-sm"
            )}
          >
            <MoreVertical className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDemandClick(demandId); }}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              loadFolderLinks();
              setFolderOpen(true);
            }}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Vincular à pasta
          </DropdownMenuItem>
          {!readOnly && !isDelivered && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive} className="text-destructive focus:text-destructive">
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
            </>
          )}
          {!readOnly && (
            <DependencyMenuItems demandId={demandId} isDelivered={isDelivered} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Folder picker popover (separate from dropdown to avoid portal issues) */}
      {folderOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={(e) => { e.stopPropagation(); setFolderOpen(false); }}
        >
          <div
            className="absolute bg-popover border rounded-lg shadow-lg p-2 w-56"
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Vincular à pasta</p>
            {allFolders && allFolders.length > 0 ? (
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {allFolders.map(folder => {
                  const isLinked = linkedFolderIds.has(folder.id);
                  return (
                    <button
                      key={folder.id}
                      onClick={() => handleToggleFolder(folder.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-sm text-left transition-colors"
                    >
                      <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: folder.color }} />
                      <span className="truncate flex-1">{folder.name}</span>
                      {isLinked && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhuma pasta disponível</p>
            )}
            <div className="mt-2 pt-2 border-t">
              <button
                onClick={() => setFolderOpen(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1 text-center"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share dialog - reuses the same component from demand detail */}
      {shareOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ShareDemandDialog demandId={demandId} open={shareOpen} onOpenChange={setShareOpen} />
        </div>
      )}
    </>
  );
}
