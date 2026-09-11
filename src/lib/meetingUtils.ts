export const DEFAULT_MEETING_TIMEZONE = "America/Recife";

export const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "30", label: "30 minutos" },
  { value: "45", label: "45 minutos" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1h30" },
  { value: "120", label: "2 horas" },
  { value: "custom", label: "Personalizado" },
];

export interface MeetingFormValue {
  time: string; // HH:mm
  duration: string; // minutes or "custom"
  customMinutes: number;
  createGoogleMeet: boolean;
}

export const emptyMeetingForm = (): MeetingFormValue => ({
  time: "10:00",
  duration: "60",
  customMinutes: 60,
  createGoogleMeet: true,
});

export function meetingDurationMinutes(value: MeetingFormValue): number {
  if (value.duration === "custom") return Math.max(5, Math.round(value.customMinutes || 0));
  return Number(value.duration) || 60;
}

/** Offset (in minutes) of a timezone at a given instant. */
function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

/**
 * Converts a wall-clock date (YYYY-MM-DD) + time (HH:mm) in `timeZone` into a
 * real instant, avoiding the device timezone entirely.
 */
export function zonedWallTimeToInstant(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.substring(0, 10).split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const naiveUtc = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  // Two passes handle DST boundaries correctly.
  let offset = timezoneOffsetMinutes(new Date(naiveUtc), timeZone);
  let instant = new Date(naiveUtc - offset * 60000);
  offset = timezoneOffsetMinutes(instant, timeZone);
  instant = new Date(naiveUtc - offset * 60000);
  return instant;
}

export function buildMeetingRange(
  dueDate: string,
  value: MeetingFormValue,
  timeZone: string,
): { starts_at: string; ends_at: string } {
  const start = zonedWallTimeToInstant(dueDate, value.time, timeZone);
  const end = new Date(start.getTime() + meetingDurationMinutes(value) * 60000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export function formatMeetingTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatMeetingDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "long",
  }).format(new Date(iso));
}

export const SYNC_STATUS_LABELS: Record<string, string> = {
  not_connected: "Não conectado",
  pending: "Aguardando sincronização",
  syncing: "Sincronizando...",
  synced: "Sincronizado com Google Calendar",
  failed: "Não foi possível sincronizar",
  reauth_required: "Reconecte seu Google Calendar",
  cancelled: "Reunião cancelada",
};

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** Domínios de teste/seed que nunca devem receber convite real do Google Calendar. */
export const NON_DELIVERABLE_EMAIL_DOMAINS = ["somadev.test"];

export function isNonDeliverableEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  return NON_DELIVERABLE_EMAIL_DOMAINS.some((d) => value.endsWith(`@${d}`));
}


/** Estado individual da integração de cada participante com o Google Calendar. */
export const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  invited: "Convite enviado",
  pending_auto_accept: "Adicionando à agenda...",
  auto_accepted: "Adicionado à agenda",
  no_google_connection: "Convite enviado",
  failed: "Convite enviado (não foi possível adicionar automaticamente)",
  reauth_required: "Reconecte o Google Calendar",
  removed: "Removido da reunião",
};

export type ParticipantStatusTone = "ok" | "info" | "warn";

export function participantStatusTone(status: string): ParticipantStatusTone {
  if (status === "auto_accepted") return "ok";
  if (status === "reauth_required") return "warn";
  return "info";
}
