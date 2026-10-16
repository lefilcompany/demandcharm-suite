import { useState, useEffect, useCallback, useRef } from "react";
import { Settings, GripVertical, Trash2, Plus, Eye, Pencil, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useAllBoardStatuses,
  useAvailableStatuses,
  useToggleBoardStatus,
  useDeactivateBoardStage,
  useUpdateBoardStatusPositions,
  useAddBoardStatus,
  useDeleteBoardStatus,
  useCreateCustomStatus,
  BoardStatus,
  isFixedBoundaryStatus,
  FIXED_END_STATUS,
  BACKLOG_STATUS_NAME,
  isBacklogStage,
  AdjustmentType,
  BOARD_ROLES,
  BoardRoleType,
  getStatusDisplayName,
} from "@/hooks/useBoardStatuses";
import { ColorPicker } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deactivationTargets, defaultDeactivationTarget, stageHasDemandsCount } from "@/lib/stageDeactivation";

interface KanbanStagesManagerProps {
  boardId: string;
}

function useBoardDemandCounts(boardId: string | null) {
  return useQuery({
    queryKey: ["board-demand-counts", boardId],
    queryFn: async () => {
      if (!boardId) return {};
      const { data, error } = await supabase
        .from("demands")
        .select("status_id")
        .eq("board_id", boardId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(d => {
        counts[d.status_id] = (counts[d.status_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!boardId,
  });
}

function StageForm({
  mode, name, color, adjustmentType, visibleToRoles,
  onNameChange, onColorChange, onAdjustmentTypeChange, onVisibleToRolesChange,
  onSubmit, onCancel, isPending,
}: {
  mode: 'create' | 'edit';
  name: string;
  color: string;
  adjustmentType: AdjustmentType;
  visibleToRoles: string[];
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onAdjustmentTypeChange: (v: AdjustmentType) => void;
  onVisibleToRolesChange: (v: string[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  const allSelected = visibleToRoles.length === 0;

  const handleRoleToggle = (roleValue: string, checked: boolean) => {
    if (allSelected) {
      const newRoles = BOARD_ROLES.filter(r => r.value !== roleValue).map(r => r.value);
      onVisibleToRolesChange(newRoles);
    } else if (checked) {
      const newRoles = [...visibleToRoles, roleValue];
      if (newRoles.length === BOARD_ROLES.length) {
        onVisibleToRolesChange([]);
      } else {
        onVisibleToRolesChange(newRoles);
      }
    } else {
      const newRoles = visibleToRoles.filter(r => r !== roleValue);
      if (newRoles.length === 0) {
        toast.error("Pelo menos um papel deve ter acesso");
        return;
      }
      onVisibleToRolesChange(newRoles);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-border/50">
        <h3 className="font-semibold text-sm">
          {mode === 'create' ? 'Criar Nova Etapa' : 'Editar Etapa'}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="stage-name">Nome da Etapa</Label>
          <Input
            id="stage-name"
            placeholder="Ex: Em Revisão"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={50}
            autoFocus
          />
        </div>
        <ColorPicker label="Cor da Etapa" value={color} onChange={onColorChange} />
        <div className="space-y-2">
          <Label htmlFor="stage-adjustment-type">Tipo de Aprovação</Label>
          <Select value={adjustmentType} onValueChange={(value: AdjustmentType) => onAdjustmentTypeChange(value)}>
            <SelectTrigger id="stage-adjustment-type">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  Nenhum (etapa normal)
                </div>
              </SelectItem>
              <SelectItem value="internal">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Aprovação Interna
                </div>
              </SelectItem>
              <SelectItem value="external">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  Aprovação Externa
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define quem pode solicitar ajustes nesta etapa.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
          <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            A etapa será criada visível para todos os papéis. Você pode ajustar a visibilidade depois na lista de etapas.
          </p>
        </div>
      </div>

      <div className="shrink-0 flex gap-2 border-t border-border/50 bg-background px-5 py-4">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={onSubmit} disabled={!name.trim() || isPending}>
          {isPending
            ? (mode === 'create' ? "Criando..." : "Salvando...")
            : (mode === 'create' ? "Criar Etapa" : "Salvar")}
        </Button>
      </div>
    </div>
  );
}

export function KanbanStagesManager({ boardId }: KanbanStagesManagerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<BoardStatus | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#3B82F6");
  const [newStatusAdjustmentType, setNewStatusAdjustmentType] = useState<AdjustmentType>("none");
  const [newStatusVisibleRoles, setNewStatusVisibleRoles] = useState<string[]>([]);
  const [localStatuses, setLocalStatuses] = useState<BoardStatus[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedRolesId, setExpandedRolesId] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<'create' | 'edit' | null>(null);
  const [editingStatus, setEditingStatus] = useState<BoardStatus | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editAdjustmentType, setEditAdjustmentType] = useState<AdjustmentType>("none");
  const [editVisibleRoles, setEditVisibleRoles] = useState<string[]>([]);

  const { data: boardStatuses, isLoading } = useAllBoardStatuses(boardId);
  const { data: availableStatuses } = useAvailableStatuses();
  const { data: demandCounts } = useBoardDemandCounts(boardId);
  
  const toggleStatus = useToggleBoardStatus();
  const deactivateStage = useDeactivateBoardStage();
  const [stageToDeactivate, setStageToDeactivate] = useState<BoardStatus | null>(null);
  const [deactivateCount, setDeactivateCount] = useState(0);
  const [deactivateTargetId, setDeactivateTargetId] = useState("");
  const updatePositions = useUpdateBoardStatusPositions();
  const addStatus = useAddBoardStatus();
  const deleteStatus = useDeleteBoardStatus();
  const createCustomStatus = useCreateCustomStatus();

  const handleUpdateVisibleRoles = async (boardStatusId: string, roles: string[]) => {
    try {
      const value = roles.length === 0 || roles.length === BOARD_ROLES.length ? null : roles;
      const { error } = await supabase
        .from("board_statuses")
        .update({ visible_to_roles: value })
        .eq("id", boardStatusId);
      if (error) throw error;
      setLocalStatuses(prev => prev.map(s => 
        s.id === boardStatusId ? { ...s, visible_to_roles: value } : s
      ));
      toast.success("Visibilidade atualizada");
    } catch {
      toast.error("Erro ao atualizar visibilidade");
    }
  };

  const openCreatePanel = () => {
    setNewStatusName("");
    setNewStatusColor("#3B82F6");
    setNewStatusAdjustmentType("none");
    setNewStatusVisibleRoles([]);
    setPanelMode('create');
  };

  const openEditPanel = (bs: BoardStatus) => {
    setEditingStatus(bs);
    setEditName(bs.status.name);
    setEditColor(bs.status.color);
    setEditAdjustmentType(bs.adjustment_type || "none");
    setEditVisibleRoles(bs.visible_to_roles || []);
    setPanelMode('edit');
  };

  const closePanel = () => {
    setPanelMode(null);
    setEditingStatus(null);
  };

  const handleEditStatus = async () => {
    if (!editingStatus || !editName.trim()) {
      toast.error("Digite um nome para a etapa");
      return;
    }
    try {
      const visibleValue = editVisibleRoles.length === 0 || editVisibleRoles.length === BOARD_ROLES.length ? null : editVisibleRoles;
      const { error: boardError } = await supabase
        .from("board_statuses")
        .update({ adjustment_type: editAdjustmentType, visible_to_roles: visibleValue })
        .eq("id", editingStatus.id);
      if (boardError) throw boardError;

      let nameColorUpdated = true;
      const nameChanged = editName.trim() !== editingStatus.status.name;
      const colorChanged = editColor !== editingStatus.status.color;
      if (nameChanged || colorChanged) {
        const { error: statusError } = await supabase
          .from("demand_statuses")
          .update({ name: editName.trim(), color: editColor })
          .eq("id", editingStatus.status_id);
        if (statusError) {
          nameColorUpdated = false;
          console.warn("Could not update status name/color:", statusError.message);
        }
      }

      setLocalStatuses(prev => prev.map(s => 
        s.id === editingStatus.id 
          ? { 
              ...s, 
              adjustment_type: editAdjustmentType,
              visible_to_roles: visibleValue,
              status: { 
                ...s.status, 
                name: nameColorUpdated ? editName.trim() : s.status.name, 
                color: nameColorUpdated ? editColor : s.status.color 
              }
            } 
          : s
      ));

      queryClient.invalidateQueries({ queryKey: ["board-statuses", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board-statuses-all", boardId] });
      queryClient.invalidateQueries({ queryKey: ["demand-statuses"] });

      if (!nameColorUpdated && (nameChanged || colorChanged)) {
        toast.success("Configurações salvas (nome/cor não alterados — etapa do sistema)");
      } else {
        toast.success("Etapa atualizada");
      }
      closePanel();
    } catch (error: any) {
      if (error.message?.includes("duplicate") || error.code === "23505") {
        toast.error("Já existe uma etapa com esse nome");
      } else {
        toast.error("Erro ao atualizar etapa");
      }
    }
  };

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setPanelMode(null);
      setEditingStatus(null);
      queryClient.refetchQueries({ queryKey: ["board-statuses", boardId] });
      queryClient.refetchQueries({ queryKey: ["board-statuses-all", boardId] });
    }
  }, [boardId, queryClient]);

  useEffect(() => {
    if (boardStatuses) {
      const sorted = [...boardStatuses].sort((a, b) => {
        const aIsEnd = a.status.name === FIXED_END_STATUS;
        const bIsEnd = b.status.name === FIXED_END_STATUS;
        if (aIsEnd) return 1;
        if (bIsEnd) return -1;
        return a.position - b.position;
      });
      setLocalStatuses(sorted);
    }
  }, [boardStatuses]);

  const handleToggleStatus = async (boardStatusId: string, isActive: boolean) => {
    // Ativar é otimista; desativar espera o banco, que recusa quando a etapa
    // ainda tem demandas (elas sumiriam do Kanban) — aí pedimos um destino.
    if (isActive) {
      setLocalStatuses(prev => prev.map(s =>
        s.id === boardStatusId ? { ...s, is_active: true } : s
      ));
    }
    try {
      await toggleStatus.mutateAsync({ boardStatusId, isActive, boardId });
      if (!isActive) {
        setLocalStatuses(prev => prev.map(s =>
          s.id === boardStatusId ? { ...s, is_active: false } : s
        ));
      }
      toast.success(isActive ? "Etapa ativada" : "Etapa desativada");
    } catch (error) {
      if (isActive) {
        setLocalStatuses(prev => prev.map(s =>
          s.id === boardStatusId ? { ...s, is_active: false } : s
        ));
      }
      const pendingDemands = !isActive ? stageHasDemandsCount(error) : null;
      if (pendingDemands !== null) {
        const stage = localStatuses.find(s => s.id === boardStatusId) ?? null;
        if (stage) {
          setStageToDeactivate(stage);
          setDeactivateCount(pendingDemands);
          setDeactivateTargetId(defaultDeactivationTarget(localStatuses, stage.id)?.status_id ?? "");
          return;
        }
      }
      console.error("Erro ao toggle etapa:", error);
      toast.error("Erro ao alterar status da etapa");
    }
  };

  const closeDeactivateDialog = () => {
    if (deactivateStage.isPending) return;
    setStageToDeactivate(null);
    setDeactivateCount(0);
    setDeactivateTargetId("");
  };

  const handleConfirmDeactivate = async () => {
    if (!stageToDeactivate || !deactivateTargetId) return;
    const stage = stageToDeactivate;
    const target = localStatuses.find(s => s.status_id === deactivateTargetId);
    try {
      const moved = await deactivateStage.mutateAsync({
        boardStatusId: stage.id,
        targetStatusId: deactivateTargetId,
        boardId,
      });
      setLocalStatuses(prev => prev.map(s => (s.id === stage.id ? { ...s, is_active: false } : s)));
      queryClient.invalidateQueries({ queryKey: ["board-demand-counts", boardId] });
      toast.success("Etapa desativada", {
        description: moved > 0
          ? `${moved} demanda${moved === 1 ? "" : "s"} movida${moved === 1 ? "" : "s"} para "${getStatusDisplayName(target?.status.name)}".`
          : undefined,
      });
      setStageToDeactivate(null);
      setDeactivateCount(0);
      setDeactivateTargetId("");
    } catch (error) {
      console.error("Erro ao desativar etapa:", error);
      toast.error("Não foi possível desativar a etapa", {
        description: error instanceof Error ? error.message : (error as { message?: string })?.message,
      });
    }
  };

  const handleDragStart = (index: number) => {
    const status = localStatuses[index];
    if (isFixedBoundaryStatus(status.status.name)) return;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const targetStatus = localStatuses[index];
    if (isFixedBoundaryStatus(targetStatus.status.name) && targetStatus.status.name === FIXED_END_STATUS) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = useCallback(async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex || isMoving) return;
    
    const draggedStatus = localStatuses[dragIndex];
    const targetStatus = localStatuses[targetIndex];
    
    if (isFixedBoundaryStatus(draggedStatus.status.name) || 
        (isFixedBoundaryStatus(targetStatus.status.name) && targetStatus.status.name === FIXED_END_STATUS)) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    setIsMoving(true);

    const newStatuses = [...localStatuses];
    const [removed] = newStatuses.splice(dragIndex, 1);
    newStatuses.splice(targetIndex, 0, removed);

    const updatedStatuses = newStatuses.map((s, i) => ({ ...s, position: i }));
    setLocalStatuses(updatedStatuses);

    try {
      const updates = updatedStatuses.map((s) =>
        supabase.from("board_statuses").update({ position: s.position }).eq("id", s.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["board-statuses", boardId] }),
        queryClient.refetchQueries({ queryKey: ["board-statuses-all", boardId] }),
      ]);
    } catch (error) {
      toast.error("Erro ao reordenar etapas");
      if (boardStatuses) {
        const sorted = [...boardStatuses].sort((a, b) => {
          if (a.status.name === FIXED_END_STATUS) return 1;
          if (b.status.name === FIXED_END_STATUS) return -1;
          return a.position - b.position;
        });
        setLocalStatuses(sorted);
      }
    } finally {
      setIsMoving(false);
      setDragIndex(null);
      setDragOverIndex(null);
    }
  }, [dragIndex, localStatuses, isMoving, boardId, boardStatuses, queryClient]);

  const handleDeleteClick = (status: BoardStatus) => {
    const demandCount = demandCounts?.[status.status_id] || 0;
    if (isFixedBoundaryStatus(status.status.name)) {
      // Allow deletion if there are other "Entregue" stages
      const entregueCount = localStatuses.filter(s => s.status.name === FIXED_END_STATUS).length;
      if (entregueCount <= 1) {
        toast.error(`A etapa "${status.status.name}" é essencial para o fluxo e não pode ser removida. Deve existir pelo menos uma.`);
        return;
      }
    }
    if (demandCount > 0) {
      toast.error(`Esta etapa possui ${demandCount} demanda${demandCount === 1 ? '' : 's'}. Mova para outra etapa antes de excluir.`);
      return;
    }
    setStatusToDelete(status);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!statusToDelete) return;
    const deletedStatus = statusToDelete;
    // Optimistic local update
    setLocalStatuses(prev => prev.filter(s => s.id !== deletedStatus.id));
    setDeleteDialogOpen(false);
    setStatusToDelete(null);
    try {
      await deleteStatus.mutateAsync({
        boardStatusId: deletedStatus.id,
        boardId,
        statusId: deletedStatus.status_id,
      });
      toast.success("Etapa removida do quadro");
    } catch (error) {
      console.error("Erro ao remover etapa:", error);
      // Revert optimistic update - refetch from server
      queryClient.refetchQueries({ queryKey: ["board-statuses-all", boardId] });
      toast.error("Erro ao remover etapa");
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatusName.trim()) {
      toast.error("Digite um nome para a etapa");
      return;
    }
    try {
      await createCustomStatus.mutateAsync({
        name: newStatusName.trim(),
        color: newStatusColor,
        boardId,
        adjustmentType: newStatusAdjustmentType,
        visibleToRoles: newStatusVisibleRoles,
      });
      toast.success("Etapa personalizada criada");
      closePanel();
      setNewStatusName("");
      setNewStatusColor("#3B82F6");
      setNewStatusAdjustmentType("none");
      setNewStatusVisibleRoles([]);
    } catch (error: any) {
      if (error.message?.includes("duplicate") || error.code === "23505") {
        toast.error("Já existe uma etapa com esse nome");
      } else {
        toast.error("Erro ao criar etapa");
      }
    }
  };

  const hasBacklogStage = localStatuses.some(s => isBacklogStage(s.status.name));

  const handleAddBacklogStage = async () => {
    try {
      await createCustomStatus.mutateAsync({
        name: BACKLOG_STATUS_NAME,
        color: "#64748B",
        boardId,
        adjustmentType: "none",
        visibleToRoles: [],
        placeFirst: true,
      });
      toast.success("Etapa Backlog adicionada ao quadro");
    } catch (error: any) {
      if (error?.message?.includes("duplicate") || error?.code === "23505") {
        toast.error("Já existe uma etapa com esse nome");
      } else {
        toast.error("Erro ao adicionar a etapa Backlog");
      }
    }
  };

  const showForm = panelMode !== null;

  // Keep panel mounted during exit animation
  // Keep panel mounted longer for smooth re-centering
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const panelTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (showForm) {
      // Mount first, then trigger visible on next frame for enter animation
      setPanelMounted(true);
      if (panelTimerRef.current) clearTimeout(panelTimerRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPanelVisible(true);
        });
      });
    } else {
      // Trigger exit animation first, then unmount after duration
      setPanelVisible(false);
      if (panelMounted) {
        panelTimerRef.current = setTimeout(() => setPanelMounted(false), 500);
      }
    }
    return () => { if (panelTimerRef.current) clearTimeout(panelTimerRef.current); };
  }, [showForm]);

  const renderFormPanel = (mobile?: boolean) => (
    <>
      {panelMode === 'create' && (
        <StageForm
          mode="create"
          name={newStatusName}
          color={newStatusColor}
          adjustmentType={newStatusAdjustmentType}
          visibleToRoles={newStatusVisibleRoles}
          onNameChange={setNewStatusName}
          onColorChange={setNewStatusColor}
          onAdjustmentTypeChange={setNewStatusAdjustmentType}
          onVisibleToRolesChange={setNewStatusVisibleRoles}
          onSubmit={handleCreateStatus}
          onCancel={closePanel}
          isPending={createCustomStatus.isPending}
        />
      )}
      {panelMode === 'edit' && (
        <StageForm
          mode="edit"
          name={editName}
          color={editColor}
          adjustmentType={editAdjustmentType}
          visibleToRoles={editVisibleRoles}
          onNameChange={setEditName}
          onColorChange={setEditColor}
          onAdjustmentTypeChange={setEditAdjustmentType}
          onVisibleToRolesChange={setEditVisibleRoles}
          onSubmit={handleEditStatus}
          onCancel={closePanel}
        />
      )}
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Etapas</span>
          </Button>
        </DialogTrigger>
        <DialogPortal>
          {/* Custom backdrop (modal={false} so we render our own to guarantee visibility) */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
            onClick={() => {
              if (!panelMounted) handleOpenChange(false);
            }}
          />
          {/* Custom layout: two visually separate cards side by side */}
          <div className={cn("fixed inset-0 z-50 flex items-center justify-center transition-[gap] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", panelVisible ? "gap-3" : "gap-0")} style={{ pointerEvents: 'none' }}>
            {/* ===== MAIN CARD: Stage List ===== */}
            <DialogPrimitive.Content
              onPointerDownOutside={(e) => {
                const target = e.target as HTMLElement;
                const isSidePanel = target?.closest?.('[data-stage-form-panel]');
                const isRadixPortal = target?.closest?.('[data-radix-popper-content-wrapper]') || target?.closest?.('[role="listbox"]') || target?.closest?.('[data-radix-select-viewport]');
                if (panelMounted || isSidePanel || isRadixPortal) {
                  e.preventDefault();
                }
              }}
              onInteractOutside={(e) => {
                const target = e.target as HTMLElement;
                const isSidePanel = target?.closest?.('[data-stage-form-panel]');
                const isRadixPortal = target?.closest?.('[data-radix-popper-content-wrapper]') || target?.closest?.('[role="listbox"]') || target?.closest?.('[data-radix-select-viewport]');
                if (panelMounted || isSidePanel || isRadixPortal) {
                  e.preventDefault();
                }
              }}
              className={cn(
                "relative bg-background border border-border rounded-xl shadow-2xl p-0 overflow-hidden pointer-events-auto flex flex-col",
                "w-[92vw] sm:w-[480px] lg:w-[520px] h-[85vh] max-h-[85vh]",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "duration-200",
                "transition-[transform,margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                // Hide on mobile/tablet when form is open, show side-by-side on lg+
                showForm ? "hidden lg:flex" : "flex"
              )}
            >
              <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>

              <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
                <DialogTitle>Gerenciar Etapas do Kanban</DialogTitle>
                <DialogDescription>
                  Configure as etapas visíveis neste quadro. Arraste para reordenar, ative/desative ou adicione novas etapas.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
                <Button variant="outline" className="w-full gap-2" onClick={openCreatePanel}>
                  <Plus className="h-4 w-4" />
                  Criar Nova Etapa
                </Button>

                {!hasBacklogStage && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Etapa Backlog (opcional)</p>
                      <p className="text-xs text-muted-foreground">
                        Primeira coluna do quadro para ideias e demandas ainda sem data de entrega. Pode ser removida a qualquer momento.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleAddBacklogStage}
                      disabled={createCustomStatus.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Backlog
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Etapas do Quadro ({localStatuses.length})</Label>
                  
                  {isLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Carregando...</div>
                  ) : localStatuses.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                      Nenhuma etapa configurada
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <TooltipProvider>
                        {localStatuses.map((bs, index) => {
                          const isFixedStatus = isFixedBoundaryStatus(bs.status.name);
                          const entregueCount = localStatuses.filter(s => s.status.name === FIXED_END_STATUS).length;
                          const isLastEntregue = isFixedStatus && entregueCount <= 1;
                          const isEndStatus = bs.status.name === FIXED_END_STATUS;
                          const isDragging = dragIndex === index;
                          const isDragOver = dragOverIndex === index && dragIndex !== index;
                          const canDrag = !isLastEntregue && !isMoving;
                          const isEditingThis = panelMode === 'edit' && editingStatus?.id === bs.id;
                          
                          return (
                            <div
                              key={bs.id}
                              draggable={canDrag}
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              onDrop={() => handleDrop(index)}
                              className={cn(
                                "rounded-lg border transition-all duration-200",
                                isEndStatus && "bg-primary/5 border-primary/20",
                                isDragging && "opacity-50 scale-95 border-dashed",
                                isDragOver && "border-primary border-2 bg-primary/5",
                                isEditingThis && "ring-2 ring-primary/50 border-primary/30",
                                !isDragging && !isDragOver && !isEndStatus && !isEditingThis && "bg-card hover:shadow-sm"
                              )}
                            >
                              <div className="flex items-center gap-2 p-2.5">
                                <div className={cn(
                                  "cursor-grab active:cursor-grabbing shrink-0",
                                  !canDrag && "opacity-30 cursor-not-allowed"
                                )}>
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>

                                <div
                                  className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background shadow-sm"
                                  style={{ backgroundColor: bs.status.color }}
                                />

                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className={cn(
                                    "font-medium text-sm truncate",
                                    !bs.is_active && "text-muted-foreground line-through"
                                  )}>
                                    {bs.status.name}
                                  </span>
                                  {isLastEntregue && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary shrink-0">Fixa</Badge>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 whitespace-nowrap tabular-nums min-w-[72px] justify-center">
                                  {demandCounts?.[bs.status_id] || 0} demandas
                                </Badge>

                                <div className="flex items-center gap-0.5 shrink-0">
                                  {!isLastEntregue ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => openEditPanel(bs)}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Editar etapa</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <div className="h-7 w-7 shrink-0" />
                                  )}

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", bs.visible_to_roles && bs.visible_to_roles.length > 0 ? "text-primary" : "text-muted-foreground")} onClick={() => setExpandedRolesId(expandedRolesId === bs.id ? null : bs.id)}>
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {bs.visible_to_roles && bs.visible_to_roles.length > 0
                                        ? `Visível para: ${bs.visible_to_roles.map(r => BOARD_ROLES.find(br => br.value === r)?.label).join(', ')}`
                                        : "Visível para todos"}
                                    </TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Switch checked={bs.is_active} onCheckedChange={(checked) => handleToggleStatus(bs.id, checked)} disabled={toggleStatus.isPending || isLastEntregue} className="scale-90" />
                                      </span>
                                    </TooltipTrigger>
                                    {isLastEntregue && <TooltipContent>Etapa fixa não pode ser desativada (única "Entregue")</TooltipContent>}
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", isLastEntregue ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10")} onClick={() => !isLastEntregue && handleDeleteClick(bs)} disabled={isLastEntregue}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{isLastEntregue ? "Deve existir pelo menos uma etapa Entregue" : "Remover etapa do quadro"}</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>

                              {expandedRolesId === bs.id && (
                                <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">Visível para:</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {BOARD_ROLES.map(role => {
                                      const currentRoles = bs.visible_to_roles || [];
                                      const isAll = currentRoles.length === 0;
                                      const isChecked = isAll || currentRoles.includes(role.value);
                                      return (
                                        <label key={role.value} className="flex items-center gap-2 text-sm cursor-pointer">
                                          <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                              let newRoles: string[];
                                              if (isAll) {
                                                newRoles = BOARD_ROLES.filter(r => r.value !== role.value).map(r => r.value);
                                              } else if (checked) {
                                                newRoles = [...currentRoles, role.value];
                                              } else {
                                                newRoles = currentRoles.filter(r => r !== role.value);
                                                if (newRoles.length === 0) {
                                                  toast.error("Pelo menos um papel deve ter acesso");
                                                  return;
                                                }
                                              }
                                              handleUpdateVisibleRoles(bs.id, newRoles);
                                            }}
                                          />
                                          {role.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  A etapa "Entregue" é fixa e essencial para o fluxo de demandas. 
                  Arraste as demais etapas pelo ícone ⠿ para reordená-las.
                  Ao desativar uma etapa que tem demandas, você escolhe para qual etapa elas vão — nenhuma demanda some do Kanban.
                </p>
              </div>
            </DialogPrimitive.Content>

            {/* ===== SEPARATE FORM PANEL (slides in from behind) ===== */}
            {panelMounted && (
              <div
                data-stage-form-panel
                 className={cn(
                  "pointer-events-auto bg-background border border-border rounded-xl overflow-hidden min-h-0",
                  "h-[85vh] max-h-[85vh]",
                  "hidden lg:flex lg:flex-col",
                  "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  panelVisible
                    ? "opacity-100 translate-x-0 scale-100 shadow-2xl w-[380px] lg:w-[420px]"
                    : "opacity-0 scale-95 shadow-none pointer-events-none w-0 border-0 p-0"
                )}
              >
                {renderFormPanel()}
              </div>
            )}

            {/* Mobile: form replaces main card */}
            {showForm && (
              <div
                data-stage-form-panel
                className="lg:hidden pointer-events-auto bg-background border border-border rounded-xl shadow-2xl flex flex-col w-[92vw] sm:w-[480px] h-[85vh] max-h-[85vh] animate-fade-in"
              >
                {renderFormPanel(true)}
              </div>
            )}
          </div>
        </DialogPortal>
      </Dialog>

      <AlertDialog open={!!stageToDeactivate} onOpenChange={(next) => { if (!next) closeDeactivateDialog(); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desativar a etapa "{getStatusDisplayName(stageToDeactivate?.status.name)}"?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Esta etapa tem <span className="font-semibold text-foreground">{deactivateCount} demanda{deactivateCount === 1 ? "" : "s"}</span>.
                  Se ela sumir do Kanban, essas demandas deixam de aparecer para a equipe.
                </p>
                <p>Escolha para qual etapa elas serão movidas antes de desativar:</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(() => {
            const targets = stageToDeactivate ? deactivationTargets(localStatuses, stageToDeactivate.id) : [];
            if (targets.length === 0) {
              return (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  Não há outra etapa ativa que possa receber essas demandas. Ative ou crie uma etapa antes de desativar esta.
                </p>
              );
            }
            return (
              <div className="space-y-2">
                <Label htmlFor="deactivate-target" className="text-xs font-medium">Mover demandas para</Label>
                <Select value={deactivateTargetId} onValueChange={setDeactivateTargetId}>
                  <SelectTrigger id="deactivate-target" className="h-9">
                    <SelectValue placeholder="Escolha uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((t) => (
                      <SelectItem key={t.id} value={t.status_id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.status.color }} />
                          {getStatusDisplayName(t.status.name)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                  <li>As demandas mantêm responsáveis, prazos e histórico.</li>
                  <li>Os envolvidos não recebem uma notificação por demanda movida.</li>
                  <li>"Fazendo" e "Em Ajuste" não aparecem aqui porque ligariam o cronômetro de todas de uma vez.</li>
                </ul>
              </div>
            );
          })()}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateStage.isPending}>Cancelar</AlertDialogCancel>
            <Button
              onClick={handleConfirmDeactivate}
              disabled={!deactivateTargetId || deactivateStage.isPending}
            >
              {deactivateStage.isPending
                ? "Movendo..."
                : `Mover ${deactivateCount} e desativar`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover etapa do quadro?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa "{statusToDelete?.status.name}" será removida deste quadro. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteStatus.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
