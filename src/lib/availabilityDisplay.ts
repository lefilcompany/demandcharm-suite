import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TeamMemberAvailability } from "@/hooks/useTeamAvailability";

/** "08:00:00" -> "08:00" (o Postgres devolve `time` com segundos). */
export function formatTime(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

/** Janela de trabalho formatada, ex.: "08:00 — 18:00". */
export function formatWorkWindow(av: TeamMemberAvailability): string | null {
  const start = formatTime(av.work_start_time);
  const end = formatTime(av.work_end_time);
  if (!start || !end) return null;
  return `${start} — ${end}`;
}

/**
 * Texto complementar de disponibilidade (ex.: "Disponível às 13:00").
 *
 * `next_available_at` é um timestamptz — deve ser parseado com o offset
 * preservado para que o navegador converta ao fuso local do leitor.
 * `absence_ends_on` é um `date` — parseado como data local via `parseISO`
 * para evitar deslocamento de um dia.
 */
export function buildAvailabilityDetail(
  av: TeamMemberAvailability,
): string | null {
  if (av.available_now) {
    return formatWorkWindow(av);
  }

  if (av.status === "vacation" && av.absence_ends_on) {
    try {
      const endsOn = parseISO(av.absence_ends_on.substring(0, 10));
      return `Retorna em ${format(endsOn, "dd/MM", { locale: ptBR })}`;
    } catch {
      return null;
    }
  }

  if (av.next_available_at) {
    try {
      const next = new Date(av.next_available_at);
      if (Number.isNaN(next.getTime())) return null;

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

/** Data de hoje (YYYY-MM-DD) no fuso local do navegador, sem deslocamento UTC. */
export function localTodayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}
