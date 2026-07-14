export const DEFAULT_NOTIFICATION_TIME_ZONE = "America/Recife";
export const DEFAULT_APP_URL = "https://pla.soma.lefil.com.br";

export type DeliveryChannel = "in_app" | "email" | "push";
export type DeliveryStatus = "sent" | "skipped" | "failed";
export type ReminderKind = "day_before" | "overdue";
export type NotificationSeverity = "warning" | "error";

export interface NotificationPreferences {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  deadlineReminders?: boolean;
}

export interface DeadlineDemand {
  id: string;
  title: string;
  due_date: string;
  assigned_to?: string | null;
}

export interface DemandAssignee {
  demand_id: string;
  user_id: string;
  is_primary?: boolean;
}

export interface UserProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

export interface DeadlineReminder {
  eventKey: string;
  eventType: "deadline_day_before" | "deadline_overdue";
  kind: ReminderKind;
  severity: NotificationSeverity;
  demandId: string;
  userId: string;
  title: string;
  message: string;
  emailSubject: string;
  link: string;
  actionUrl: string;
  userName?: string;
  dueDateKey: string;
}

export function isAuthorized(
  authHeader: string | null | undefined,
  cronSecret: string | null | undefined,
): boolean {
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

function getDatePartsInTimeZone(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return representedAsUtc - date.getTime();
}

export function zonedStartOfDayToUtc(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const desiredWallClockAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);

  let guess = desiredWallClockAsUtc;
  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(guess), timeZone);
    guess = desiredWallClockAsUtc - offset;
  }

  return new Date(guess);
}

export function getTomorrowUtcWindow(
  now: Date,
  timeZone = DEFAULT_NOTIFICATION_TIME_ZONE,
): { dateKey: string; start: Date; end: Date } {
  const todayKey = formatDateKeyInTimeZone(now, timeZone);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const dayAfterKey = addDaysToDateKey(tomorrowKey, 1);

  return {
    dateKey: tomorrowKey,
    start: zonedStartOfDayToUtc(tomorrowKey, timeZone),
    end: zonedStartOfDayToUtc(dayAfterKey, timeZone),
  };
}

export function buildAssigneeMap(assignees: DemandAssignee[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const assignee of assignees) {
    const current = map.get(assignee.demand_id) ?? [];
    if (!current.includes(assignee.user_id)) current.push(assignee.user_id);
    map.set(assignee.demand_id, current);
  }

  return map;
}

/**
 * Returns only users allocated to the demand. The legacy assigned_to field is
 * used exclusively as a fallback for old records that have no demand_assignees.
 */
export function getDemandRecipientIds(
  demand: DeadlineDemand,
  assigneeMap: Map<string, string[]>,
): string[] {
  const recipients = assigneeMap.get(demand.id) ?? [];
  if (recipients.length > 0) return [...new Set(recipients)];
  return demand.assigned_to ? [demand.assigned_to] : [];
}

export function getEnabledDeliveryChannels(
  preferences: NotificationPreferences | null | undefined,
  kind: ReminderKind = "day_before",
): DeliveryChannel[] {
  if (preferences?.deadlineReminders === false) return [];

  const channels: DeliveryChannel[] = [];
  if (preferences?.pushNotifications !== false) {
    channels.push("in_app", "push");
  }
  // Preserve the existing overdue behavior (in-app + FCM) and avoid a daily
  // overdue email. Email is part of the new day-before reminder only.
  if (kind === "day_before" && preferences?.emailNotifications !== false) {
    channels.push("email");
  }
  return channels;
}

export function normalizeAppUrl(appUrl: string | undefined): string {
  const fallback = DEFAULT_APP_URL;
  try {
    const parsed = new URL(appUrl || fallback);
    if (parsed.protocol !== "https:") return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function formatDateForPtBr(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function reminderBase(
  demand: DeadlineDemand,
  userId: string,
  dueDateKey: string,
  appUrl?: string,
  userName?: string | null,
) {
  const safeTitle = truncate(demand.title.trim() || "Demanda sem título", 90);
  const link = `/demands/${demand.id}`;
  return {
    safeTitle,
    formattedDate: formatDateForPtBr(dueDateKey),
    link,
    actionUrl: `${normalizeAppUrl(appUrl)}${link}`,
    demandId: demand.id,
    userId,
    userName: userName?.trim() || undefined,
    dueDateKey,
  };
}

export function buildDayBeforeReminder(
  demand: DeadlineDemand,
  userId: string,
  dueDateKey: string,
  appUrl?: string,
  userName?: string | null,
): DeadlineReminder {
  const base = reminderBase(demand, userId, dueDateKey, appUrl, userName);
  return {
    eventKey: `deadline_day_before:${demand.id}:${dueDateKey}`,
    eventType: "deadline_day_before",
    kind: "day_before",
    severity: "warning",
    demandId: base.demandId,
    userId: base.userId,
    title: "⏰ Demanda vence amanhã",
    message: `A demanda “${base.safeTitle}” vence amanhã (${base.formattedDate}) e ainda não foi entregue.`,
    emailSubject: `Lembrete: “${base.safeTitle}” vence amanhã`,
    link: base.link,
    actionUrl: base.actionUrl,
    userName: base.userName,
    dueDateKey: base.dueDateKey,
  };
}

export function buildOverdueReminder(
  demand: DeadlineDemand,
  userId: string,
  dueDateKey: string,
  notificationDateKey: string,
  appUrl?: string,
  userName?: string | null,
): DeadlineReminder {
  const base = reminderBase(demand, userId, dueDateKey, appUrl, userName);
  return {
    eventKey: `deadline_overdue:${demand.id}:${notificationDateKey}`,
    eventType: "deadline_overdue",
    kind: "overdue",
    severity: "error",
    demandId: base.demandId,
    userId: base.userId,
    title: "🚨 Demanda com prazo vencido",
    message: `A demanda “${base.safeTitle}” venceu em ${base.formattedDate} e ainda não foi entregue.`,
    emailSubject: `Prazo vencido: “${base.safeTitle}”`,
    link: base.link,
    actionUrl: base.actionUrl,
    userName: base.userName,
    dueDateKey: base.dueDateKey,
  };
}

// Backwards-compatible alias used by existing tests/imports.
export const buildDeadlineReminder = buildDayBeforeReminder;
