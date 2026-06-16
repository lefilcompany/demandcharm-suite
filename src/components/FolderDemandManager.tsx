import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, ChevronDown, ChevronRight, Save } from "lucide-react";
import { useAllTeamDemands } from "@/hooks/useAllTeamDemands";
import { useFolderDemandIds, useAddDemandToFolder, useRemoveDemandFromFolder } from "@/hooks/useDemandFolders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FolderDemandManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  teamId: string | null;
}

export function FolderDemandManager({
  open,
  onOpenChange,
  folderId,
  folderName,
  teamId,
}: FolderDemandManagerProps) {
  const [search, setSearch] = useState("");
  const [openBoards, setOpenBoards] = useState<Record<string, boolean>>({});
  const { data: allDemands } = useAllTeamDemands(teamId);
  const { data: folderDemandIds } = useFolderDemandIds(folderId);
  const addDemand = useAddDemandToFolder();
  const removeDemand = useRemoveDemandFromFolder();

  // Local draft of selected demand IDs
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Sync draft with server data when it loads or modal opens
  useEffect(() => {
    if (open && folderDemandIds) {
      setDraftIds(new Set(folderDemandIds));
    }
  }, [open, folderDemandIds]);

  const groupedDemands = useMemo(() => {
    if (!allDemands) return [];
    const q = search.toLowerCase().trim();
    const filtered = q
      ? (allDemands as any[]).filter((d: any) =>
          d.title?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.demand_statuses?.name?.toLowerCase().includes(q) ||
          d.priority?.toLowerCase().includes(q) ||
          d.boards?.name?.toLowerCase().includes(q)
        )
      : (allDemands as any[]);

    const boardMap = new Map<string, { boardName: string; boardId: string; demands: any[] }>();
    for (const d of filtered) {
      const boardId = d.board_id || "unknown";
      const boardName = d.boards?.name || "Sem quadro";
      if (!boardMap.has(boardId)) {
        boardMap.set(boardId, { boardId, boardName, demands: [] });
      }
      boardMap.get(boardId)!.demands.push(d);
    }
    return Array.from(boardMap.values()).sort((a, b) => a.boardName.localeCompare(b.boardName));
  }, [allDemands, search]);

  const isInDraft = (demandId: string) => draftIds.has(demandId);

  const handleToggle = (demandId: string) => {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(demandId)) {
        next.delete(demandId);
      } else {
        next.add(demandId);
      }
      return next;
    });
  };

  const toggleBoard = (boardId: string) => {
    setOpenBoards((prev) => ({ ...prev, [boardId]: !prev[boardId] }));
  };

  const isBoardOpen = (boardId: string) => {
    if (search.trim()) return true;
    return openBoards[boardId] ?? false;
  };

  // Compute diff between server state and draft
  const hasChanges = useMemo(() => {
    const serverSet = new Set(folderDemandIds || []);
    if (draftIds.size !== serverSet.size) return true;
    for (const id of draftIds) {
      if (!serverSet.has(id)) return true;
    }
    return false;
  }, [draftIds, folderDemandIds]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const serverSet = new Set(folderDemandIds || []);
      const toAdd = [...draftIds].filter((id) => !serverSet.has(id));
      const toRemove = [...serverSet].filter((id) => !draftIds.has(id));

      await Promise.all([
        ...toAdd.map((demand_id) =>
          addDemand.mutateAsync({ folder_id: folderId, demand_id })
        ),
        ...toRemove.map((demand_id) =>
          removeDemand.mutateAsync({ folder_id: folderId, demand_id })
        ),
      ]);

      toast.success("Demandas atualizadas com sucesso");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = draftIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Gerenciar demandas — {folderName}</DialogTitle>
          </div>
          {selectedCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedCount} {selectedCount === 1 ? "demanda selecionada" : "demandas selecionadas"}
            </p>
          )}
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, status, prioridade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <ScrollArea className="h-[380px] pr-3 -mr-3">
          <div className="space-y-1">
            {groupedDemands.map((group) => {
              const boardSelected = group.demands.filter((d: any) => isInDraft(d.id)).length;
              return (
                <Collapsible
                  key={group.boardId}
                  open={isBoardOpen(group.boardId)}
                  onOpenChange={() => toggleBoard(group.boardId)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                    {isBoardOpen(group.boardId) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-foreground truncate flex-1">
                      {group.boardName}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {boardSelected > 0 && (
                        <Badge className="text-[10px] h-5 px-1.5 bg-[#F28705] hover:bg-[#F28705] text-white border-0">
                          {boardSelected} no projeto
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">{group.demands.length} total</span>
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-2 border-l border-border/50 pl-2 space-y-0.5 mb-1">
                      {group.demands.map((d: any) => (
                        <label
                          key={d.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={isInDraft(d.id)}
                            onCheckedChange={() => handleToggle(d.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{d.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {d.demand_statuses?.name && (
                                <span
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${d.demand_statuses.color}20`,
                                    color: d.demand_statuses.color,
                                  }}
                                >
                                  {d.demand_statuses.name}
                                </span>
                              )}
                              {d.priority && (
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                    d.priority === "alta"
                                      ? "bg-destructive/10 text-destructive"
                                      : d.priority === "média"
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {d.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            {groupedDemands.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhuma demanda encontrada
              </p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-[#F28705] hover:bg-[#D97706] text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
