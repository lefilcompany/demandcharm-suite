import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ChevronDown, ChevronRight, Pencil, Power, Save, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRecurringDemands, useUpdateRecurringDemand, useDeleteRecurringDemand, calculateNextRunDate } from "@/hooks/useRecurringDemands";
import { toast } from "sonner";

interface ScheduledDemandsModalProps {
  boardId: string | null;
  teamId: string | null;
  buttonStyle?: "compact" | "standard";
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};
const PRIORITY_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "média", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export function ScheduledDemandsModal({ boardId, teamId, buttonStyle = "compact" }: ScheduledDemandsModalProps) {
  const { t } = useTranslation();
  const { data: recurringDemands, isLoading } = useRecurringDemands(boardId || undefined);
  const updateMutation = useUpdateRecurringDemand();
  const deleteMutation = useDeleteRecurringDemand();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const count = recurringDemands?.length || 0;

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      description: item.description || "",
      priority: item.priority || "média",
      frequency: item.frequency,
      weekdays: item.weekdays || [],
      day_of_month: item.day_of_month,
      start_date: item.start_date,
      end_date: item.end_date || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: string) => {
    try {
      await updateMutation.mutateAsync({
        id,
        title: editForm.title,
        description: editForm.description || null,
        priority: editForm.priority,
        frequency: editForm.frequency,
        weekdays: editForm.weekdays,
        day_of_month: editForm.day_of_month || null,
        start_date: editForm.start_date,
        end_date: editForm.end_date || null,
      });
      toast.success("Agendamento atualizado!");
      setEditingId(null);
    } catch {
      toast.error("Erro ao atualizar agendamento");
    }
  };

  const deactivate = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Agendamento desativado!");
    } catch {
      toast.error("Erro ao desativar agendamento");
    }
  };

  const toggleWeekday = (day: number) => {
    const current: number[] = editForm.weekdays || [];
    setEditForm({
      ...editForm,
      weekdays: current.includes(day)
        ? current.filter((d: number) => d !== day)
        : [...current, day].sort(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className={`
            inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium h-8
            transition-all duration-200 whitespace-nowrap
            ${count > 0 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "bg-background border border-border/60 hover:border-primary/40 hover:text-primary"
            }
          `}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          <span>Agendadas</span>
          {count > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-3xl h-[90vh] sm:h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Demandas Agendadas
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !recurringDemands || recurringDemands.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarClock className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma demanda agendada para este quadro.</p>
          </div>
        ) : (
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {recurringDemands.map((item: any) => (
              <ScheduledDemandItem
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                editForm={editForm}
                setEditForm={setEditForm}
                onStartEdit={() => startEditing(item)}
                onCancelEdit={cancelEditing}
                onSave={() => saveEdit(item.id)}
                onDeactivate={() => deactivate(item.id)}
                onToggleWeekday={toggleWeekday}
                isSaving={updateMutation.isPending}
                isDeactivating={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ScheduledDemandItemProps {
  item: any;
  isEditing: boolean;
  editForm: Record<string, any>;
  setEditForm: (form: Record<string, any>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDeactivate: () => void;
  onToggleWeekday: (day: number) => void;
  isSaving: boolean;
  isDeactivating: boolean;
}

function ScheduledDemandItem({
  item,
  isEditing,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDeactivate,
  onToggleWeekday,
  isSaving,
  isDeactivating,
}: ScheduledDemandItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Compute the effective next run date: if stored date is today or past, recalculate
  const getEffectiveNextRunDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stored = new Date(item.next_run_date + "T00:00:00");
    if (stored <= today) {
      return calculateNextRunDate(item.frequency, item.next_run_date, item.weekdays, item.day_of_month);
    }
    return item.next_run_date;
  };

  const effectiveNextRun = getEffectiveNextRunDate();

  const priorityColor: Record<string, string> = {
    baixa: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    média: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    alta: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    urgente: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {FREQUENCY_LABELS[item.frequency] || item.frequency}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  Próxima: {format(new Date(effectiveNextRun + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${priorityColor[item.priority] || ""}`}>
              {item.priority}
            </Badge>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                  <RichTextEditor
                    value={editForm.description}
                    onChange={(html) => setEditForm({ ...editForm, description: html })}
                    minHeight="80px"
                    placeholder="Descrição da demanda..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
                    <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Frequência</label>
                    <Select value={editForm.frequency} onValueChange={(v) => setEditForm({ ...editForm, frequency: v })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(editForm.frequency === "weekly" || editForm.frequency === "biweekly") && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Dias da semana</label>
                    <div className="flex gap-1">
                      {WEEKDAY_LABELS.map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onToggleWeekday(i)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors
                            ${(editForm.weekdays || []).includes(i)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editForm.frequency === "monthly" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Dia do mês</label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={editForm.day_of_month || ""}
                      onChange={(e) => setEditForm({ ...editForm, day_of_month: parseInt(e.target.value) || null })}
                      className="h-8 text-sm w-24"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Data início</label>
                    <Input
                      type="date"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Data fim (opcional)</label>
                    <Input
                      type="date"
                      value={editForm.end_date}
                      onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={onSave} disabled={isSaving} className="h-7 text-xs">
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                {item.description && (
                  <RichTextDisplay content={item.description} className="text-sm text-muted-foreground" />
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Frequência:</span>{" "}
                    <span className="font-medium">{FREQUENCY_LABELS[item.frequency] || item.frequency}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prioridade:</span>{" "}
                    <span className="font-medium capitalize">{item.priority}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Próxima criação:</span>{" "}
                    <span className="font-medium">
                      {format(new Date(effectiveNextRun + "T00:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Início:</span>{" "}
                    <span className="font-medium">
                      {format(new Date(item.start_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  {item.end_date && (
                    <div>
                      <span className="text-muted-foreground">Fim:</span>{" "}
                      <span className="font-medium">
                        {format(new Date(item.end_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  {(item.frequency === "weekly" || item.frequency === "biweekly") && item.weekdays?.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dias:</span>{" "}
                      <span className="font-medium">
                        {item.weekdays.map((d: number) => WEEKDAY_LABELS[d]).join(", ")}
                      </span>
                    </div>
                  )}
                  {item.frequency === "monthly" && item.day_of_month && (
                    <div>
                      <span className="text-muted-foreground">Dia do mês:</span>{" "}
                      <span className="font-medium">{item.day_of_month}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={onStartEdit} className="h-7 text-xs">
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDeactivate}
                    disabled={isDeactivating}
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isDeactivating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                    Desativar
                  </Button>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
