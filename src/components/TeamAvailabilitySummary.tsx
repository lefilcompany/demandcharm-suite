import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  CalendarDays,
  CalendarOff,
  Palmtree,
  Plane,
  AlertCircle,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTeamAvailability } from "@/hooks/useTeamAvailability";
import {
  useTeamMembers,
  type TeamMember,
} from "@/hooks/useTeamMembers";
import type {
  AvailabilityStatus,
  TeamMemberAvailability,
} from "@/hooks/useTeamAvailability";

/**
 * Resumo compacto de "Quem está disponível agora".
 * Cruza useTeamMembers × useTeamAvailability em memória (por user_id).
 * Não faz novas queries por usuário.
 */

const statusMeta: Record<
  AvailabilityStatus,
  { label: string; icon: React.ReactNode; dot: string }
> = {
  available: {
    label: "Disponível agora",
    icon: <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />,
    dot: "bg-emerald-500",
  },
  outside_hours: {
    label: "Fora do horário",
    icon: <Clock className="h-3 w-3" />,
    dot: "bg-amber-500",
  },
  day_off: {
    label: "Folga hoje",
    icon: <CalendarOff className="h-3 w-3" />,
    dot: "bg-slate-400",
  },
  vacation: {
    label: "Férias",
    icon: <Palmtree className="h-3 w-3" />,
    dot: "bg-sky-500",
  },
  leave: {
    label: "Licença",
    icon: <Plane className="h-3 w-3" />,
    dot: "bg-indigo-500",
  },
  other_absence: {
    label: "Ausente",
    icon: <CalendarOff className="h-3 w-3" />,
    dot: "bg-rose-500",
  },
  holiday: {
    label: "Feriado",
    icon: <CalendarDays className="h-3 w-3" />,
    dot: "bg-purple-500",
  },
  unconfigured: {
    label: "Horário não configurado",
    icon: <AlertCircle className="h-3 w-3" />,
    dot: "bg-muted-foreground",
  },
};

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function nextAvailableText(av: TeamMemberAvailability): string | null {
  if (av.available_now) {
    if (av.work_start_time && av.work_end_time) {
      return `${av.work_start_time} — ${av.work_end_time}`;
    }
    return null;
  }
  if (av.status === "vacation" && av.absence_ends_on) {
    try {
      return `Retorna em ${format(
        new Date(av.absence_ends_on.substring(0, 10)),
        "dd/MM",
        { locale: ptBR },
      )}`;
    } catch {
      return null;
    }
  }
  if (av.next_available_at) {
    try {
      const next = new Date(av.next_available_at.substring(0, 19));
      const now = new Date();
      const isSameDay =
        next.getFullYear() === now.getFullYear() &&
        next.getMonth() === now.getMonth() &&
        next.getDate() === now.getDate();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow =
        next.getFullYear() === tomorrow.getFullYear() &&
        next.getMonth() === tomorrow.getMonth() &&
        next.getDate() === tomorrow.getDate();
      const time = format(next, "HH:mm");
      if (isSameDay) return `Disponível às ${time}`;
      if (isTomorrow) return `Disponível amanhã às ${time}`;
      return `Disponível em ${format(next, "dd/MM", { locale: ptBR })} às ${time}`;
    } catch {
      return null;
    }
  }
  return null;
}

interface EnrichedMember {
  member: TeamMember;
  availability: TeamMemberAvailability | undefined;
}

interface TeamAvailabilitySummaryProps {
  teamId: string | null | undefined;
}

export function TeamAvailabilitySummary({ teamId }: TeamAvailabilitySummaryProps) {
  const [open, setOpen] = useState(false);
  const { data: members, isLoading: membersLoading } = useTeamMembers(
    (teamId ?? null) as string | null,
  );
  const { data: availability, isLoading: availabilityLoading } =
    useTeamAvailability(teamId);

  const availabilityByUser = useMemo(() => {
    const map = new Map<string, TeamMemberAvailability>();
    (availability ?? []).forEach((a) => map.set(a.user_id, a));
    return map;
  }, [availability]);

  const enriched: EnrichedMember[] = useMemo(() => {
    return (members ?? []).map((member) => ({
      member,
      availability: availabilityByUser.get(member.user_id),
    }));
  }, [members, availabilityByUser]);

  const counts = useMemo(() => {
    const c = {
      available: 0,
      outside_hours: 0,
      vacation: 0,
      other_absence: 0,
      unconfigured: 0,
      off: 0, // folga/feriado
    };
    enriched.forEach(({ availability }) => {
      if (!availability) {
        c.unconfigured += 1;
        return;
      }
      switch (availability.status) {
        case "available":
          c.available += 1;
          break;
        case "outside_hours":
          c.outside_hours += 1;
          break;
        case "vacation":
        case "leave":
          c.vacation += 1;
          break;
        case "other_absence":
          c.other_absence += 1;
          break;
        case "day_off":
        case "holiday":
          c.off += 1;
          break;
        case "unconfigured":
          c.unconfigured += 1;
          break;
      }
    });
    return c;
  }, [enriched]);

  const availableNowMembers = useMemo(
    () =>
      enriched
        .filter((e) => e.availability?.available_now)
        .sort((a, b) =>
          (a.member.profile?.full_name || "").localeCompare(
            b.member.profile?.full_name || "",
            "pt-BR",
          ),
        ),
    [enriched],
  );

  // Grupos para o Dialog
  const groups = useMemo(() => {
    const g: { title: string; members: EnrichedMember[] }[] = [
      { title: "Disponíveis agora", members: [] },
      { title: "Fora do horário", members: [] },
      { title: "Férias e ausências", members: [] },
      { title: "Folga / feriado", members: [] },
      { title: "Não configurados", members: [] },
    ];
    enriched.forEach((e) => {
      const s = e.availability?.status;
      if (!e.availability || s === "unconfigured") {
        g[4].members.push(e);
      } else if (s === "available") g[0].members.push(e);
      else if (s === "outside_hours") g[1].members.push(e);
      else if (s === "vacation" || s === "leave" || s === "other_absence")
        g[2].members.push(e);
      else if (s === "day_off" || s === "holiday") g[3].members.push(e);
    });
    g.forEach((grp) =>
      grp.members.sort((a, b) =>
        (a.member.profile?.full_name || "").localeCompare(
          b.member.profile?.full_name || "",
          "pt-BR",
        ),
      ),
    );
    return g.filter((grp) => grp.members.length > 0);
  }, [enriched]);

  const isLoading = membersLoading || availabilityLoading;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <Skeleton className="h-5 w-44 mb-3" />
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!enriched.length) return null;

  const summaryRows = [
    { count: counts.available, label: "disponíveis", dot: "bg-emerald-500" },
    { count: counts.outside_hours, label: "fora do horário", dot: "bg-amber-500" },
    { count: counts.vacation, label: "de férias/licença", dot: "bg-sky-500" },
    { count: counts.other_absence, label: "ausentes", dot: "bg-rose-500" },
    { count: counts.off, label: "folga/feriado", dot: "bg-purple-500" },
  ].filter((r) => r.count > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Disponibilidade da equipe</h3>
          </div>

          {summaryRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum membro com horário configurado.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
              {summaryRows.map((r) => (
                <div key={r.label} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />
                  <span className="text-xs">
                    <strong className="font-semibold">{r.count}</strong>{" "}
                    <span className="text-muted-foreground">{r.label}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {availableNowMembers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {availableNowMembers.slice(0, 8).map(({ member }) => (
                <Avatar
                  key={member.id}
                  className="h-7 w-7 border-2 border-background shadow-sm"
                >
                  <AvatarImage
                    src={member.profile.avatar_url || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-[10px] bg-muted font-semibold">
                    {getInitials(member.profile.full_name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {availableNowMembers.length > 8 && (
                <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
                  +{availableNowMembers.length - 8}
                </div>
              )}
            </div>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Disponibilidade da equipe
          </DialogTitle>
          <DialogDescription>
            Resumo planejado de disponibilidade — não indica presença física.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-1 -mr-1 space-y-4 mt-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum membro encontrado.
            </p>
          ) : (
            groups.map((grp) => (
              <div key={grp.title}>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {grp.title}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    ({grp.members.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {grp.members.map(({ member, availability }) => {
                    const meta = availability
                      ? statusMeta[availability.status]
                      : statusMeta.unconfigured;
                    const next = availability
                      ? nextAvailableText(availability)
                      : null;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={member.profile.avatar_url || undefined}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-xs bg-muted font-semibold">
                              {getInitials(member.profile.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${meta.dot}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {member.profile.full_name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {member.position && (
                              <span className="text-xs text-muted-foreground truncate">
                                {member.position.name}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              {meta.icon}
                              {meta.label}
                            </span>
                          </div>
                        </div>
                        {next && (
                          <span className="text-xs text-muted-foreground text-right shrink-0 max-w-[40%]">
                            {next}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
