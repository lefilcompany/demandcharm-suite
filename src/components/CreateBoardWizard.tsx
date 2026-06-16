import { useState, useMemo, useCallback, useEffect } from "react";
import { useCreateBoard, type CreateBoardData } from "@/hooks/useBoards";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useServices, useHierarchicalServices, type ServiceWithHierarchy } from "@/hooks/useServices";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Loader2, ArrowLeft, ArrowRight, Check, Plus, Trash2, GripVertical,
  Package, Users, Layers, FileText, Search, AlertCircle, Lock, ShieldCheck, Shield, Wrench, MessageSquare,
  Folder, FolderOpen, ChevronDown, ChevronRight,
  CircleDot, ClipboardCheck, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ADJUSTMENT_OPTIONS = [
  { value: "none" as const, label: "Nenhuma", icon: CircleDot, description: "Etapa padrão, não dispara notificação de aprovação" },
  { value: "internal" as const, label: "Interna", icon: ClipboardCheck, description: "Envia notificação para a equipe interna realizar a aprovação" },
  { value: "external" as const, label: "Externa", icon: UserCheck, description: "Envia notificação para o cliente realizar a aprovação" },
];

const STAGE_PRESET_COLORS = [
  "#6B7280", "#1D1D1D", "#3B82F6", "#0EA5E9",
  "#10B981", "#22C55E", "#F59E0B", "#F28705",
  "#EF4444", "#EC4899", "#9333EA", "#6366F1",
];

interface StageColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

function StageColorPicker({ value, onChange, disabled }: StageColorPickerProps) {
  const [hex, setHex] = useState(value);
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(hex);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "h-8 w-8 rounded-md border border-border shrink-0 shadow-sm transition-all",
            "hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40",
            disabled && "opacity-50 cursor-not-allowed hover:scale-100"
          )}
          style={{ backgroundColor: value }}
          title="Escolher cor"
          aria-label="Escolher cor"
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cores sugeridas</p>
            <div className="grid grid-cols-6 gap-1.5">
              {STAGE_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setHex(c); }}
                  className={cn(
                    "h-7 w-7 rounded-md border transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary",
                    value.toUpperCase() === c.toUpperCase()
                      ? "border-foreground ring-2 ring-primary/50 scale-110"
                      : "border-border"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Cor personalizada</p>
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 shrink-0 rounded-md border border-border overflow-hidden">
                <div className="absolute inset-0" style={{ backgroundColor: value }} />
                <input
                  type="color"
                  value={value}
                  onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Seletor de cor"
                />
              </div>
              <Input
                value={hex}
                onChange={(e) => {
                  const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                  setHex(v.toUpperCase());
                  if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
                }}
                placeholder="#RRGGBB"
                maxLength={7}
                className="h-9 font-mono uppercase text-xs"
              />
            </div>
            {!isValidHex && hex.length > 0 && (
              <p className="text-[10px] text-destructive">Formato esperado: #RRGGBB</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type AdjustmentType = "none" | "internal" | "external";

const ADJUSTMENT_STYLES: Record<AdjustmentType, { dot: string; tint: string; ring: string; label: string }> = {
  none:     { dot: "bg-muted-foreground", tint: "bg-muted/40",         ring: "ring-muted-foreground/40", label: "text-foreground" },
  internal: { dot: "bg-blue-500",         tint: "bg-blue-500/10",      ring: "ring-blue-500/50",         label: "text-blue-700 dark:text-blue-400" },
  external: { dot: "bg-purple-500",       tint: "bg-purple-500/10",    ring: "ring-purple-500/50",       label: "text-purple-700 dark:text-purple-400" },
};

interface AdjustmentTypePickerProps {
  value: AdjustmentType;
  onChange: (v: AdjustmentType) => void;
  disabled?: boolean;
}

function AdjustmentTypePicker({ value, onChange, disabled }: AdjustmentTypePickerProps) {
  const current = ADJUSTMENT_OPTIONS.find((o) => o.value === value) ?? ADJUSTMENT_OPTIONS[0];
  const Icon = current.icon;
  const style = ADJUSTMENT_STYLES[value];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium shrink-0 transition-all w-[140px]",
            style.tint,
            style.label,
            "hover:border-foreground/30 focus:outline-none focus:ring-2",
            style.ring,
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={current.description}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />
          <Icon className="h-3.5 w-3.5 opacity-80 shrink-0" />
          <span className="flex-1 text-left truncate">{current.label}</span>
          <svg className="h-3 w-3 opacity-50 group-hover:opacity-80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="end">
        <div className="space-y-1.5">
          {ADJUSTMENT_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            const s = ADJUSTMENT_STYLES[opt.value];
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={cn(
                  "w-full flex items-start gap-2.5 rounded-md p-2 text-left transition-colors",
                  selected ? cn(s.tint, "ring-1", s.ring) : "hover:bg-muted/60"
                )}
              >
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", s.tint)}>
                  <OptIcon className={cn("h-4 w-4", s.label)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-sm font-semibold", selected && s.label)}>{opt.label}</span>
                    {selected && <Check className={cn("h-3.5 w-3.5", s.label)} />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
type BoardRole = "admin" | "moderator" | "executor" | "requester";

interface Stage {
  id: string;
  name: string;
  color: string;
  adjustment_type: AdjustmentType;
  locked?: boolean; // "Entregue"
}

interface SelectedService {
  serviceId: string;
  serviceName: string;
  monthlyLimit: number;
}

const makeStageId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `stage-${Math.random().toString(36).slice(2)}-${Date.now()}`;

const DEFAULT_STAGES: Stage[] = [
  { id: makeStageId(), name: "A Iniciar", color: "#6B7280", adjustment_type: "none" },
  { id: makeStageId(), name: "Fazendo", color: "#3B82F6", adjustment_type: "none" },
  { id: makeStageId(), name: "Aprovação Interna", color: "#3B82F6", adjustment_type: "internal" },
  { id: makeStageId(), name: "Em Ajuste", color: "#9333EA", adjustment_type: "none" },
  { id: makeStageId(), name: "Entregue", color: "#10B981", adjustment_type: "none", locked: true },
];

const STAGE_COLORS = ["#6B7280", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#9333EA", "#F28705", "#EC4899"];

const ROLE_OPTIONS: { value: BoardRole; label: string; short: string; icon: React.ElementType; color: string }[] = [
  { value: "admin", label: "Administrador", short: "Admin", icon: ShieldCheck, color: "text-red-600" },
  { value: "moderator", label: "Coordenador", short: "Coord", icon: Shield, color: "text-blue-600" },
  { value: "executor", label: "Agente", short: "Agente", icon: Wrench, color: "text-green-600" },
  { value: "requester", label: "Solicitante", short: "Solic", icon: MessageSquare, color: "text-purple-600" },
];

interface StepDef {
  key: string;
  label: string;
  icon: React.ElementType;
}

const STEPS: StepDef[] = [
  { key: "info", label: "Informações", icon: FileText },
  { key: "stages", label: "Etapas", icon: Layers },
  { key: "members", label: "Membros", icon: Users },
  { key: "services", label: "Serviços", icon: Package },
  { key: "review", label: "Revisão", icon: Check },
];

interface SortableStageRowProps {
  stage: Stage;
  onChangeColor: (c: string) => void;
  onChangeName: (n: string) => void;
  onChangeAdjustment: (v: AdjustmentType) => void;
  onRemove: () => void;
}

function SortableStageRow({
  stage, onChangeColor, onChangeName, onChangeAdjustment, onRemove,
}: SortableStageRowProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging, isOver,
  } = useSortable({ id: stage.id, disabled: stage.locked });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-card p-2",
        "will-change-transform",
        stage.locked && "border-dashed bg-muted/30",
        isDragging && "shadow-lg ring-2 ring-primary/40 bg-card cursor-grabbing",
        !isDragging && isOver && !stage.locked && "ring-1 ring-primary/30",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={stage.locked}
        className={cn(
          "flex h-8 w-6 items-center justify-center rounded touch-none shrink-0 outline-none",
          stage.locked
            ? "cursor-not-allowed text-muted-foreground/30"
            : "cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary",
        )}
        title={stage.locked ? "Etapa fixa" : "Arrastar para reordenar"}
        aria-label="Reordenar etapa"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <StageColorPicker value={stage.color} onChange={onChangeColor} disabled={stage.locked} />

      <Input
        value={stage.name}
        disabled={stage.locked}
        onChange={(e) => onChangeName(e.target.value)}
        className="h-8 flex-1"
      />

      <AdjustmentTypePicker
        value={stage.adjustment_type}
        onChange={onChangeAdjustment}
        disabled={stage.locked}
      />

      {stage.locked ? (
        <div className="flex h-8 w-8 items-center justify-center shrink-0" title="Etapa obrigatória">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

interface ServicesPickerProps {
  hierarchical: ServiceWithHierarchy[] | undefined;
  allServices: { id: string; name: string; estimated_hours: number; parent_id: string | null }[];
  selectedServices: SelectedService[];
  serviceSearch: string;
  onSearchChange: (v: string) => void;
  openFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  onToggleService: (id: string, name: string, checked: boolean) => void;
  onSetLimit: (id: string, limit: number) => void;
  onSelectAll: (checked: boolean) => void;
}

function ServicesPicker({
  hierarchical, allServices, selectedServices, serviceSearch, onSearchChange,
  openFolders, onToggleFolder, onToggleService, onSetLimit, onSelectAll,
}: ServicesPickerProps) {
  const search = serviceSearch.trim().toLowerCase();
  const matchesSearch = (name: string) => !search || name.toLowerCase().includes(search);

  // Folders (parents) are NOT services — exclude them from selection
  const folderIdSet = new Set(allServices.filter((s) => s.parent_id).map((s) => s.parent_id as string));
  const selectableServices = allServices.filter((s) => !folderIdSet.has(s.id));
  const totalLeaves = selectableServices.length;
  const allSelected = totalLeaves > 0 && selectedServices.length === totalLeaves;

  // Render a single leaf service row
  const ServiceRow = ({ service, indent = false }: { service: { id: string; name: string; estimated_hours: number }; indent?: boolean }) => {
    const sel = selectedServices.find((s) => s.serviceId === service.id);
    return (
      <div className={cn("rounded-md transition-colors", sel && "bg-primary/5", indent && "pl-6")}>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Checkbox
            checked={!!sel}
            onCheckedChange={(c) => onToggleService(service.id, service.name, c === true)}
          />
          <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <label className="flex-1 text-sm cursor-pointer truncate" onClick={() => onToggleService(service.id, service.name, !sel)}>
            <span className="font-medium">{service.name}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">{service.estimated_hours}h</span>
          </label>
        </div>
        {sel && (
          <div className={cn("flex items-center gap-2 pb-2 px-2", indent ? "pl-9" : "pl-9")}>
            <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Limite mensal</Label>
            <Input
              type="number"
              min={0}
              value={sel.monthlyLimit}
              onChange={(e) => onSetLimit(service.id, parseInt(e.target.value) || 0)}
              className="h-7 w-20 text-xs"
            />
            <span className="text-[11px] text-muted-foreground">
              {sel.monthlyLimit === 0 ? "ilimitado" : "demandas/mês"}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Folder (category) row with children
  const FolderRow = ({ folder }: { folder: ServiceWithHierarchy }) => {
    // visible children (filtered by search)
    const visibleChildren = folder.children.filter((c) => matchesSearch(c.name) || matchesSearch(folder.name));
    if (visibleChildren.length === 0 && search && !matchesSearch(folder.name)) return null;

    const isOpen = openFolders.has(folder.id) || !!search;
    // Only children are real selectable services — the folder is just a grouping
    const groupIds = folder.children.map((c) => c.id);
    const selectedCount = selectedServices.filter((s) => groupIds.includes(s.serviceId)).length;
    const allChildrenSelected = groupIds.length > 0 && selectedCount === groupIds.length;

    const toggleAllInGroup = (checked: boolean) => {
      folder.children.forEach((child) => {
        const isSel = selectedServices.some((s) => s.serviceId === child.id);
        if (checked && !isSel) onToggleService(child.id, child.name, true);
        if (!checked && isSel) onToggleService(child.id, child.name, false);
      });
    };

    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-2 hover:bg-muted/40 transition-colors">
          <button
            type="button"
            onClick={() => onToggleFolder(folder.id)}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted shrink-0"
            aria-label={isOpen ? "Recolher" : "Expandir"}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Checkbox
            checked={allChildrenSelected}
            onCheckedChange={(c) => toggleAllInGroup(c === true)}
          />
          {isOpen ? (
            <FolderOpen className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-primary shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onToggleFolder(folder.id)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span className="text-sm font-semibold truncate">{folder.name}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {selectedCount}/{groupIds.length}
            </span>
          </button>
        </div>
        {isOpen && (
          <div className="border-t bg-muted/20 py-1">
            {visibleChildren.map((child) => (
              <ServiceRow key={child.id} service={child} indent />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!hierarchical) return null;

  // Split top-level entries into folders (categories) and standalone services
  const folders = hierarchical.filter((s) => s.isCategory);
  const standalone = hierarchical.filter((s) => !s.isCategory);

  const visibleFolders = folders.filter(
    (f) => matchesSearch(f.name) || f.children.some((c) => matchesSearch(c.name)),
  );
  const visibleStandalone = standalone.filter((s) => matchesSearch(s.name));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar serviço ou pasta..."
          value={serviceSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(c) => onSelectAll(c === true)}
          />
          <span className="text-xs font-medium">Selecionar todos os serviços</span>
        </label>
        <span className="text-[11px] text-muted-foreground">
          {selectedServices.length} de {totalLeaves} selecionados
        </span>
      </div>

      {visibleFolders.length === 0 && visibleStandalone.length === 0 ? (
        <p className="text-center py-6 text-sm text-muted-foreground">
          Nenhum serviço encontrado.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleFolders.map((folder) => (
            <FolderRow key={folder.id} folder={folder} />
          ))}
          {visibleStandalone.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-3 py-1.5 border-b bg-muted/30">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Serviços independentes
                </span>
              </div>
              <div className="py-1">
                {visibleStandalone.map((s) => (
                  <ServiceRow key={s.id} service={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateBoardWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

const DRAFT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const draftKey = (teamId: string | null | undefined) => `create-board-draft:${teamId ?? "none"}`;

interface BoardDraft {
  savedAt: number;
  stepIdx: number;
  name: string;
  description: string;
  stages: Stage[];
  memberRoles: [string, BoardRole][];
  selectedServices: SelectedService[];
}

function loadDraft(teamId: string | null | undefined): BoardDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardDraft;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(draftKey(teamId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function CreateBoardWizard({ onComplete, onCancel }: CreateBoardWizardProps) {
  const { selectedTeamId } = useSelectedTeam();
  const createBoard = useCreateBoard();
  const { data: teamServices, isLoading: servicesLoading } = useServices(selectedTeamId);
  const { data: hierarchicalServices } = useHierarchicalServices(selectedTeamId);
  const [serviceSearch, setServiceSearch] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  // Open all folders by default once hierarchical services are loaded
  useEffect(() => {
    if (hierarchicalServices && hierarchicalServices.length > 0) {
      setOpenFolders((prev) => {
        if (prev.size > 0) return prev;
        const ids = hierarchicalServices.filter((s) => s.isCategory).map((s) => s.id);
        return new Set(ids);
      });
    }
  }, [hierarchicalServices]);
  const { data: teamMembers } = useTeamMembers(selectedTeamId);

  // Initial draft (loaded synchronously to avoid flicker)
  const initialDraft = useMemo(() => loadDraft(selectedTeamId), [selectedTeamId]);

  const [stepIdx, setStepIdx] = useState(initialDraft?.stepIdx ?? 0);
  const [maxStepIdx, setMaxStepIdx] = useState(initialDraft?.stepIdx ?? 0);
  const [error, setError] = useState("");

  // Step 1
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");

  // Step 2
  const [stages, setStages] = useState<Stage[]>(initialDraft?.stages ?? DEFAULT_STAGES);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(STAGE_COLORS[0]);

  // Step 3
  const [memberRoles, setMemberRoles] = useState<Map<string, BoardRole>>(
    new Map(initialDraft?.memberRoles ?? [])
  );
  const [memberSearch, setMemberSearch] = useState("");

  // Step 4
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>(
    initialDraft?.selectedServices ?? []
  );

  // Persist draft (debounced) on any change
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        const isPristine =
          stepIdx === 0 &&
          !name.trim() &&
          !description.trim() &&
          memberRoles.size === 0 &&
          selectedServices.length === 0 &&
          JSON.stringify(stages) === JSON.stringify(DEFAULT_STAGES);
        if (isPristine) {
          localStorage.removeItem(draftKey(selectedTeamId));
          return;
        }
        const draft: BoardDraft = {
          savedAt: Date.now(),
          stepIdx,
          name,
          description,
          stages,
          memberRoles: Array.from(memberRoles.entries()),
          selectedServices,
        };
        localStorage.setItem(draftKey(selectedTeamId), JSON.stringify(draft));
      } catch {
        // ignore quota / serialization errors
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [selectedTeamId, stepIdx, name, description, stages, memberRoles, selectedServices]);

  const filteredMembers = useMemo(() => {
    if (!teamMembers) return [];
    // Exclude team admins (auto-added as moderator) and current user (auto-added as admin)
    const eligible = teamMembers.filter((m) => m.role !== "owner");
    if (!memberSearch.trim()) return eligible;
    const q = memberSearch.toLowerCase();
    return eligible.filter((m) => m.profile.full_name.toLowerCase().includes(q));
  }, [teamMembers, memberSearch]);

  const toggleMember = useCallback((userId: string) => {
    setMemberRoles((prev) => {
      const next = new Map(prev);
      if (next.has(userId)) next.delete(userId);
      else next.set(userId, "executor");
      return next;
    });
  }, []);

  const setRole = useCallback((userId: string, role: BoardRole) => {
    setMemberRoles((prev) => {
      const next = new Map(prev);
      next.set(userId, role);
      return next;
    });
  }, []);

  // Stage handlers
  const addStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed) return;
    if (stages.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("Já existe uma etapa com esse nome");
      return;
    }
    setError("");
    // Insert before "Entregue"
    const idx = stages.findIndex((s) => s.locked);
    const insertIdx = idx >= 0 ? idx : stages.length;
    const next = [...stages];
    next.splice(insertIdx, 0, { id: makeStageId(), name: trimmed, color: newStageColor, adjustment_type: "none" });
    setStages(next);
    setNewStageName("");
  };

  const removeStage = (idx: number) => {
    if (stages[idx].locked) return;
    setStages(stages.filter((_, i) => i !== idx));
  };

  const updateStage = (idx: number, patch: Partial<Stage>) => {
    setStages(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  // Drag and drop for stages (smooth, with @dnd-kit)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleStageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStages((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      if (prev[oldIndex].locked) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      // Always keep locked stages anchored at the end
      const unlocked = moved.filter((s) => !s.locked);
      const locked = moved.filter((s) => s.locked);
      return [...unlocked, ...locked];
    });
  };

  // Service handlers
  const toggleService = (id: string, name: string, checked: boolean) => {
    if (checked) setSelectedServices((p) => [...p, { serviceId: id, serviceName: name, monthlyLimit: 0 }]);
    else setSelectedServices((p) => p.filter((s) => s.serviceId !== id));
  };
  const setLimit = (id: string, limit: number) => {
    setSelectedServices((p) => p.map((s) => (s.serviceId === id ? { ...s, monthlyLimit: limit } : s)));
  };

  // Validation per step
  const validateStep = (): string | null => {
    if (stepIdx === 0) {
      const t = name.trim();
      if (!t) return "Nome do quadro é obrigatório";
      if (t.length > 100) return "Nome deve ter no máximo 100 caracteres";
    }
    if (stepIdx === 1) {
      if (stages.length < 2) return "O quadro precisa de pelo menos 2 etapas";
      if (!stages.some((s) => s.locked && s.name === "Entregue")) return "A etapa 'Entregue' é obrigatória";
    }
    if (stepIdx === 3) {
      if (!teamServices || teamServices.length === 0) return "Cadastre serviços antes de criar o quadro";
      if (selectedServices.length === 0) return "Selecione ao menos um serviço";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStepIdx((i) => {
      const n = Math.min(i + 1, STEPS.length - 1);
      setMaxStepIdx((m) => Math.max(m, n));
      return n;
    });
  };

  const prev = () => {
    setError("");
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  const submit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    if (!selectedTeamId) { setError("Equipe não selecionada"); return; }
    setError("");

    const payload: CreateBoardData = {
      team_id: selectedTeamId,
      name: name.trim(),
      description: description.trim() || null,
      services: selectedServices.map((s) => ({ service_id: s.serviceId, monthly_limit: s.monthlyLimit })),
      stages: stages.map((s) => ({ name: s.name, color: s.color, adjustment_type: s.adjustment_type })),
      members: Array.from(memberRoles.entries()).map(([user_id, role]) => ({ user_id, role })),
    };

    try {
      await createBoard.mutateAsync(payload);
      try { localStorage.removeItem(draftKey(selectedTeamId)); } catch { /* noop */ }
      onComplete();
    } catch (e) {
      console.error(e);
    }
  };

  const isSubmitting = createBoard.isPending;
  const isLast = stepIdx === STEPS.length - 1;

  const hasNoServices = !servicesLoading && (!teamServices || teamServices.length === 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Stepper header */}
      <div className="px-1 pb-4 shrink-0">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === stepIdx;
            const visited = i <= maxStepIdx;
            const done = i < stepIdx;
            const canJump = visited && i !== stepIdx;
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => { if (canJump) { setError(""); setStepIdx(i); } }}
                  disabled={!canJump && !active}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium transition-colors outline-none",
                    active && "bg-primary text-primary-foreground",
                    !active && visited && "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary",
                    !visited && "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  title={canJump ? `Ir para ${s.label}` : s.label}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-background/30 text-[10px]">
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                  <Icon className="h-3.5 w-3.5 sm:hidden" />
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px flex-1 mx-1", i < maxStepIdx ? "bg-primary/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {stepIdx === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wiz-name">Nome do Quadro *</Label>
              <Input
                id="wiz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Marketing, Desenvolvimento..."
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wiz-desc">Descrição</Label>
              <Textarea
                id="wiz-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o propósito deste quadro..."
                rows={3}
                maxLength={500}
                className="resize-none"
              />
            </div>
          </div>
        )}

        {stepIdx === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Defina as etapas (status) do Kanban deste quadro. Você pode criar novas etapas ou remover as padrões. A etapa <strong>Entregue</strong> é obrigatória e fica sempre por último.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStageDragEnd}
            >
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="w-6 shrink-0" />
                    <div className="w-9 shrink-0">Cor</div>
                    <div className="flex-1">Etapa</div>
                    <div className="w-[140px] shrink-0">Notificação</div>
                    <div className="w-8 shrink-0" />
                  </div>
                  {stages.map((s, i) => (
                    <SortableStageRow
                      key={s.id}
                      stage={s}
                      onChangeColor={(c) => updateStage(i, { color: c })}
                      onChangeName={(n) => updateStage(i, { name: n })}
                      onChangeAdjustment={(v) => updateStage(i, { adjustment_type: v })}
                      onRemove={() => removeStage(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center gap-2 rounded-lg border border-dashed p-2 bg-muted/20">
              <StageColorPicker value={newStageColor} onChange={setNewStageColor} />
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }}
                placeholder="Nome da nova etapa..."
                className="h-8 flex-1"
              />
              <Button type="button" size="sm" onClick={addStage} disabled={!newStageName.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        )}

        {stepIdx === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecione membros adicionais e defina o cargo de cada um neste quadro. Você (criador) será adicionado como Administrador automaticamente, e administradores da equipe entram como Coordenadores.
            </p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar membro..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredMembers.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                {teamMembers && teamMembers.length > 0
                  ? "Nenhum membro encontrado."
                  : "Sua equipe ainda não tem outros membros."}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((m) => {
                  const isSelected = memberRoles.has(m.user_id);
                  const role = memberRoles.get(m.user_id) || "executor";
                  return (
                    <div
                      key={m.user_id}
                      onClick={() => toggleMember(m.user_id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2.5 transition-colors cursor-pointer hover:bg-muted/50",
                        isSelected ? "border-primary bg-primary/5 hover:bg-primary/10" : "bg-card"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(m.user_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {m.profile.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.profile.full_name}</p>
                        {m.position && (
                          <p className="text-[11px] text-muted-foreground truncate">{m.position.name}</p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex gap-1">
                          {ROLE_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const active = role === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setRole(m.user_id, opt.value); }}
                                className={cn(
                                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                                  active
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-transparent text-muted-foreground hover:bg-muted"
                                )}
                                title={opt.label}
                              >
                                <Icon className="h-3 w-3" />
                                <span className="hidden md:inline">{opt.short}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {memberRoles.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {memberRoles.size} membro(s) selecionado(s)
              </p>
            )}
          </div>
        )}

        {stepIdx === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecione os serviços disponíveis neste quadro e defina o limite mensal (0 = ilimitado).
            </p>

            {hasNoServices ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Não há serviços cadastrados nesta equipe. Cadastre serviços antes de criar este quadro.
                </AlertDescription>
              </Alert>
            ) : servicesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ServicesPicker
                hierarchical={hierarchicalServices}
                allServices={teamServices!}
                selectedServices={selectedServices}
                serviceSearch={serviceSearch}
                onSearchChange={setServiceSearch}
                openFolders={openFolders}
                onToggleFolder={(id) => setOpenFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })}
                onToggleService={toggleService}
                onSetLimit={setLimit}
                onSelectAll={(checked) => {
                  if (checked) {
                    // Exclude folders (parents) — they are not real services
                    const folderIds = new Set(
                      (teamServices ?? []).filter((s) => s.parent_id).map((s) => s.parent_id as string),
                    );
                    setSelectedServices(
                      (teamServices ?? [])
                        .filter((s) => !folderIds.has(s.id))
                        .map((s) => ({ serviceId: s.id, serviceName: s.name, monthlyLimit: 0 })),
                    );
                  } else {
                    setSelectedServices([]);
                  }
                }}
              />
            )}
          </div>
        )}

        {stepIdx === 4 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Revise as informações abaixo antes de criar o quadro. Você pode voltar para ajustar qualquer etapa.
            </p>

            {/* Informações */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-primary" />
                  Informações
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStepIdx(0)}>
                  Editar
                </Button>
              </div>
              <div className="text-sm">
                <p className="font-medium">{name.trim() || <span className="text-muted-foreground italic">Sem nome</span>}</p>
                {description.trim() ? (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{description.trim()}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic mt-1">Sem descrição</p>
                )}
              </div>
            </div>

            {/* Etapas */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Layers className="h-4 w-4 text-primary" />
                  Etapas <span className="text-xs font-normal text-muted-foreground">({stages.length})</span>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStepIdx(1)}>
                  Editar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stages.map((s) => {
                  const opt = ADJUSTMENT_OPTIONS.find((o) => o.value === s.adjustment_type);
                  const OptIcon = opt?.icon;
                  return (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs"
                      title={opt?.label}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-medium">{s.name}</span>
                      {OptIcon && s.adjustment_type !== "none" && (
                        <OptIcon className="h-3 w-3 text-muted-foreground" />
                      )}
                      {s.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Membros */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  Membros adicionais <span className="text-xs font-normal text-muted-foreground">({memberRoles.size})</span>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStepIdx(2)}>
                  Editar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Você será adicionado como Administrador. Administradores da equipe entram como Coordenadores.
              </p>
              {memberRoles.size === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum membro adicional selecionado.</p>
              ) : (
                <div className="space-y-1.5">
                  {Array.from(memberRoles.entries()).map(([uid, role]) => {
                    const m = teamMembers?.find((tm) => tm.user_id === uid);
                    const opt = ROLE_OPTIONS.find((r) => r.value === role);
                    const Icon = opt?.icon;
                    return (
                      <div key={uid} className="flex items-center gap-2 text-sm">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={m?.profile.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {(m?.profile.full_name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{m?.profile.full_name || "Membro"}</span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", opt?.color)}>
                          {Icon && <Icon className="h-3 w-3" />}
                          {opt?.short}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Serviços */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-primary" />
                  Serviços <span className="text-xs font-normal text-muted-foreground">({selectedServices.length})</span>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStepIdx(3)}>
                  Editar
                </Button>
              </div>
              {selectedServices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum serviço selecionado.</p>
              ) : (
                <div className="space-y-1">
                  {selectedServices.map((s) => (
                    <div key={s.serviceId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.serviceName}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {s.monthlyLimit === 0 ? "Ilimitado" : `${s.monthlyLimit}/mês`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive shrink-0 pt-2">{error}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t shrink-0 mt-3">
        <Button
          type="button"
          variant="outline"
          onClick={stepIdx === 0 ? onCancel : prev}
          disabled={isSubmitting || (stepIdx === 0 && !onCancel)}
        >
          {stepIdx === 0 ? "Cancelar" : (<><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</>)}
        </Button>

        <span className="text-xs text-muted-foreground">
          Passo {stepIdx + 1} de {STEPS.length}
        </span>

        {isLast ? (
          <Button onClick={submit} disabled={isSubmitting || hasNoServices}>
            {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>) : "Criar Quadro"}
          </Button>
        ) : (
          <Button onClick={next} disabled={isSubmitting}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
