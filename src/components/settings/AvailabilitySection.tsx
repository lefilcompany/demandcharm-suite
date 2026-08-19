import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Plus, Pencil, Trash2, Loader2, Plane, PartyPopper } from "lucide-react";

import { SectionShell } from "./SectionShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useIsTeamAdmin } from "@/hooks/useTeamRole";
import {
  useWorkSchedule,
  useSaveWorkSchedule,
  WEEKDAY_LABELS,
  Weekday,
  WorkScheduleInput,
} from "@/hooks/useWorkSchedule";
import {
  useAbsences,
  useCreateAbsence,
  useUpdateAbsence,
  useDeleteAbsence,
  ABSENCE_TYPE_LABELS,
  AbsenceType,
  Absence,
} from "@/hooks/useAbsences";
import {
  useTeamHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  TeamHoliday,
} from "@/hooks/useTeamHolidays";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Ordem de exibição: segunda a domingo */
const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Timezones IANA suportados (estrutura preparada para novos valores). */
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Recife", label: "America/Recife (UTC-3)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (UTC-3)" },
];

const DEFAULT_TIMEZONE = "America/Recife";

function buildDefaultDays(): Record<Weekday, WorkScheduleInput> {
  const base = {} as Record<Weekday, WorkScheduleInput>;
  WEEK_ORDER.forEach((weekday) => {
    const isWeekend = weekday === 0 || weekday === 6;
    base[weekday] = {
      weekday,
      start_time: "08:00",
      end_time: "18:00",
      is_enabled: !isWeekend,
    };
  });
  return base;
}

/** Normaliza "08:00:00" -> "08:00" para inputs type=time */
function toTimeInput(value: string) {
  return value?.slice(0, 5) ?? "";
}

function formatDate(value: string) {
  try {
    return format(parseISO(value.substring(0, 10)), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

const todayISO = () => new Date().toISOString().substring(0, 10);

export function AvailabilitySection() {
  const { user } = useAuth();
  const { currentTeam } = useSelectedTeam();
  const teamId = currentTeam?.id ?? null;
  const queryClient = useQueryClient();
  const { isAdmin } = useIsTeamAdmin(teamId);

  /* ------------------------------- horário -------------------------------- */
  const { data: schedule, isLoading: loadingSchedule } = useWorkSchedule(teamId, user?.id);
  const saveSchedule = useSaveWorkSchedule();

  const [days, setDays] = useState<Record<Weekday, WorkScheduleInput>>(buildDefaultDays);
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [savingTimezone, setSavingTimezone] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-timezone", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, timezone")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile?.timezone) setTimezone(profile.timezone);
  }, [profile?.timezone]);

  useEffect(() => {
    if (!schedule || schedule.length === 0) return;
    setDays((prev) => {
      const next = { ...prev };
      schedule.forEach((row) => {
        next[row.weekday] = {
          weekday: row.weekday,
          start_time: toTimeInput(row.start_time),
          end_time: toTimeInput(row.end_time),
          is_enabled: row.is_enabled,
        };
      });
      return next;
    });
  }, [schedule]);

  const updateDay = (weekday: Weekday, patch: Partial<WorkScheduleInput>) => {
    setDays((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...patch } }));
  };

  const handleSaveSchedule = async () => {
    if (!teamId) return;

    const invalid = WEEK_ORDER.filter(
      (d) => days[d].is_enabled && days[d].start_time >= days[d].end_time,
    );
    if (invalid.length > 0) {
      toast.error("O horário final deve ser maior que o inicial");
      return;
    }

    try {
      setSavingTimezone(true);
      await saveSchedule.mutateAsync({
        teamId,
        days: WEEK_ORDER.map((d) => ({
          ...days[d],
          start_time: `${days[d].start_time}:00`.slice(0, 8),
          end_time: `${days[d].end_time}:00`.slice(0, 8),
        })),
      });

      if (user && timezone !== profile?.timezone) {
        const { error } = await supabase
          .from("profiles")
          .update({ timezone })
          .eq("id", user.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["profile-timezone", user.id] });
      }

      toast.success("Horário salvo com sucesso");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar horário");
    } finally {
      setSavingTimezone(false);
    }
  };

  /* ------------------------------ ausências ------------------------------- */
  const { data: absences, isLoading: loadingAbsences } = useAbsences(teamId, user?.id);
  const createAbsence = useCreateAbsence();
  const updateAbsence = useUpdateAbsence();
  const deleteAbsence = useDeleteAbsence();

  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [absenceType, setAbsenceType] = useState<AbsenceType>("vacation");
  const [absenceStart, setAbsenceStart] = useState(todayISO);
  const [absenceEnd, setAbsenceEnd] = useState(todayISO);
  const [absenceNote, setAbsenceNote] = useState("");
  const [absenceToDelete, setAbsenceToDelete] = useState<Absence | null>(null);

  const openNewAbsence = () => {
    setEditingAbsence(null);
    setAbsenceType("vacation");
    setAbsenceStart(todayISO());
    setAbsenceEnd(todayISO());
    setAbsenceNote("");
    setAbsenceOpen(true);
  };

  const openEditAbsence = (absence: Absence) => {
    setEditingAbsence(absence);
    setAbsenceType(absence.type);
    setAbsenceStart(absence.starts_on.substring(0, 10));
    setAbsenceEnd(absence.ends_on.substring(0, 10));
    setAbsenceNote(absence.note ?? "");
    setAbsenceOpen(true);
  };

  const handleSaveAbsence = async () => {
    if (!teamId) return;
    if (!absenceStart || !absenceEnd) {
      toast.error("Informe as datas inicial e final");
      return;
    }
    if (absenceEnd < absenceStart) {
      toast.error("A data final deve ser igual ou posterior à inicial");
      return;
    }

    try {
      if (editingAbsence) {
        await updateAbsence.mutateAsync({
          absenceId: editingAbsence.id,
          teamId,
          type: absenceType,
          startsOn: absenceStart,
          endsOn: absenceEnd,
          note: absenceNote,
        });
        toast.success("Ausência atualizada");
      } else {
        await createAbsence.mutateAsync({
          teamId,
          type: absenceType,
          startsOn: absenceStart,
          endsOn: absenceEnd,
          note: absenceNote,
        });
        toast.success("Ausência registrada");
      }
      setAbsenceOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar ausência");
    }
  };

  const handleDeleteAbsence = async () => {
    if (!absenceToDelete || !teamId) return;
    try {
      await deleteAbsence.mutateAsync({ absenceId: absenceToDelete.id, teamId });
      toast.success("Ausência removida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover ausência");
    } finally {
      setAbsenceToDelete(null);
    }
  };

  // Somente ausências atuais e futuras
  const upcomingAbsences = useMemo(() => {
    const today = todayISO();
    return (absences ?? [])
      .filter((a) => a.ends_on.substring(0, 10) >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  }, [absences]);

  /* ------------------------------- feriados -------------------------------- */
  const { data: holidays, isLoading: loadingHolidays } = useTeamHolidays(teamId);
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [holidayOpen, setHolidayOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<TeamHoliday | null>(null);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState(todayISO);
  const [holidayToDelete, setHolidayToDelete] = useState<TeamHoliday | null>(null);

  const openNewHoliday = () => {
    setEditingHoliday(null);
    setHolidayName("");
    setHolidayDate(todayISO());
    setHolidayOpen(true);
  };

  const openEditHoliday = (holiday: TeamHoliday) => {
    setEditingHoliday(holiday);
    setHolidayName(holiday.name);
    setHolidayDate(holiday.date.substring(0, 10));
    setHolidayOpen(true);
  };

  const handleSaveHoliday = async () => {
    if (!teamId) return;
    if (!holidayName.trim()) {
      toast.error("Informe o nome do feriado");
      return;
    }
    try {
      if (editingHoliday) {
        await updateHoliday.mutateAsync({
          holidayId: editingHoliday.id,
          teamId,
          name: holidayName,
          date: holidayDate,
        });
        toast.success("Feriado atualizado");
      } else {
        await createHoliday.mutateAsync({ teamId, name: holidayName, date: holidayDate });
        toast.success("Feriado adicionado");
      }
      setHolidayOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar feriado");
    }
  };

  const handleDeleteHoliday = async () => {
    if (!holidayToDelete || !teamId) return;
    try {
      await deleteHoliday.mutateAsync({ holidayId: holidayToDelete.id, teamId });
      toast.success("Feriado removido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover feriado");
    } finally {
      setHolidayToDelete(null);
    }
  };

  if (!teamId) {
    return (
      <SectionShell
        icon={CalendarClock}
        title="Disponibilidade"
        description="Horário, férias e ausências"
      >
        <p className="text-sm text-muted-foreground">
          Selecione uma equipe para configurar sua disponibilidade.
        </p>
      </SectionShell>
    );
  }

  const savingScheduleState = saveSchedule.isPending || savingTimezone;

  return (
    <div className="space-y-6">
      {/* 1. MEU HORÁRIO */}
      <SectionShell
        icon={CalendarClock}
        title="Meu horário de trabalho"
        description="Defina os dias e horários em que você normalmente está disponível."
      >
        {loadingSchedule ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {WEEK_ORDER.map((weekday) => {
              const day = days[weekday];
              return (
                <div
                  key={weekday}
                  className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={day.is_enabled}
                      onCheckedChange={(checked) => updateDay(weekday, { is_enabled: checked })}
                      aria-label={`Ativar ${WEEKDAY_LABELS[weekday]}`}
                    />
                    <Label className="text-sm font-medium">{WEEKDAY_LABELS[weekday]}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.start_time}
                      disabled={!day.is_enabled}
                      onChange={(e) => updateDay(weekday, { start_time: e.target.value })}
                      className="h-9 w-[120px]"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={day.end_time}
                      disabled={!day.is_enabled}
                      onChange={(e) => updateDay(weekday, { end_time: e.target.value })}
                      className="h-9 w-[120px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Fuso horário</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="h-9 w-full sm:w-[260px]">
                <SelectValue placeholder="Selecione o fuso" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveSchedule} disabled={savingScheduleState}>
            {savingScheduleState && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar horário
          </Button>
        </div>
      </SectionShell>

      {/* 2. FÉRIAS E AUSÊNCIAS */}
      <SectionShell
        icon={Plane}
        title="Férias e ausências"
        description="Registre períodos em que você não estará disponível."
        action={
          <Button size="sm" onClick={openNewAbsence}>
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar ausência
          </Button>
        }
      >
        {loadingAbsences ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : upcomingAbsences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma ausência registrada para os próximos dias.
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingAbsences.map((absence) => (
              <div
                key={absence.id}
                className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ABSENCE_TYPE_LABELS[absence.type]}</Badge>
                    <span className="text-sm text-foreground">
                      {formatDate(absence.starts_on)} → {formatDate(absence.ends_on)}
                    </span>
                  </div>
                  {absence.note && (
                    <p className="mt-1 text-xs text-muted-foreground truncate">{absence.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEditAbsence(absence)}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setAbsenceToDelete(absence)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Excluir</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      {/* 3. FERIADOS DA EQUIPE */}
      <SectionShell
        icon={PartyPopper}
        title="Feriados da equipe"
        description="Dias sem expediente para toda a equipe."
        action={
          isAdmin ? (
            <Button size="sm" variant="outline" onClick={openNewHoliday}>
              <Plus className="h-4 w-4 mr-1.5" />
              Adicionar feriado
            </Button>
          ) : undefined
        }
      >
        {loadingHolidays ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : !holidays || holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{holiday.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(holiday.date)}</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditHoliday(holiday)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setHolidayToDelete(holiday)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionShell>

      {/* Dialog de ausência */}
      <Dialog open={absenceOpen} onOpenChange={setAbsenceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAbsence ? "Editar ausência" : "Nova ausência"}</DialogTitle>
            <DialogDescription>
              Informe o período em que você estará indisponível.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {ABSENCE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data inicial</Label>
                <Input
                  type="date"
                  value={absenceStart}
                  onChange={(e) => setAbsenceStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data final</Label>
                <Input
                  type="date"
                  value={absenceEnd}
                  onChange={(e) => setAbsenceEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={absenceNote}
                onChange={(e) => setAbsenceNote(e.target.value)}
                placeholder="Ex.: férias programadas"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsenceOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAbsence}
              disabled={createAbsence.isPending || updateAbsence.isPending}
            >
              {(createAbsence.isPending || updateAbsence.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de feriado */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Editar feriado" : "Novo feriado"}</DialogTitle>
            <DialogDescription>Feriados valem para toda a equipe.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="Ex.: Independência"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveHoliday}
              disabled={createHoliday.isPending || updateHoliday.isPending}
            >
              {(createHoliday.isPending || updateHoliday.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmações de exclusão */}
      <AlertDialog open={!!absenceToDelete} onOpenChange={(o) => !o && setAbsenceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ausência?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAbsence}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!holidayToDelete} onOpenChange={(o) => !o && setHolidayToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feriado?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHoliday}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
