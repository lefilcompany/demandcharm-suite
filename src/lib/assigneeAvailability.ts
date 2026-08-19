import type { Absence, AbsenceType } from "@/hooks/useAbsences";

const TYPE_PHRASE: Record<AbsenceType, string> = {
  vacation: "estará de férias",
  day_off: "estará de folga",
  leave: "estará de licença",
  other: "estará indisponível",
};

/** Converte "YYYY-MM-DD" (ou ISO) para data local sem deslocamento de fuso. */
function toLocalDate(value: string): Date {
  const [y, m, d] = value.substring(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatBR(value: string): string {
  const d = toLocalDate(value);
  return d.toLocaleDateString("pt-BR");
}

/**
 * Retorna a ausência que impede a atribuição de uma demanda com a data de
 * entrega informada. Bloqueia quando a ausência cobre a data de entrega ou
 * qualquer dia entre hoje e a data de entrega.
 */
export function findBlockingAbsence(
  absences: Absence[] | undefined,
  userId: string,
  dueDate: string | null | undefined,
): Absence | null {
  if (!absences?.length || !dueDate) return null;

  const due = toLocalDate(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = today <= due ? today : due;

  const found = absences
    .filter((a) => a.user_id === userId)
    .filter((a) => {
      const start = toLocalDate(a.starts_on);
      const end = toLocalDate(a.ends_on);
      return start <= due && end >= windowStart;
    })
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  return found[0] ?? null;
}

export function buildUnavailableMessage(name: string, absence: Absence): string {
  const phrase = TYPE_PHRASE[absence.type] ?? TYPE_PHRASE.other;
  return `${name || "Este usuário"} não pode receber essa demanda porque ${phrase} de ${formatBR(
    absence.starts_on,
  )} até ${formatBR(absence.ends_on)}.`;
}

export function absenceShortLabel(absence: Absence): string {
  const phrase = (TYPE_PHRASE[absence.type] ?? TYPE_PHRASE.other).replace("estará ", "");
  return `Indisponível (${phrase}) ${formatBR(absence.starts_on)} – ${formatBR(absence.ends_on)}`;
}

/**
 * Extrai a mensagem amigável levantada pelo trigger do banco
 * (`ASSIGNEE_UNAVAILABLE: ...`), se houver.
 */
export function parseAssigneeUnavailableError(error: unknown): string | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : typeof error === "string"
          ? error
          : "";

  const idx = message.indexOf("ASSIGNEE_UNAVAILABLE:");
  if (idx === -1) return null;
  return message.slice(idx + "ASSIGNEE_UNAVAILABLE:".length).trim();
}
