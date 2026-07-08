// Pure helpers for process-recurring-demands.
// Kept free of I/O so they can be unit-tested in isolation.

export const VALID_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly", "yearly"] as const;
export type Frequency = (typeof VALID_FREQUENCIES)[number];

export function isValidFrequency(value: unknown): value is Frequency {
  return typeof value === "string" && (VALID_FREQUENCIES as readonly string[]).includes(value);
}

/**
 * Authorisation check used by the edge function.
 * Returns true only when the incoming Authorization header carries the
 * configured CRON_SECRET as a bearer token. Both arguments must be present.
 */
export function isAuthorized(authHeader: string | null | undefined, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  if (!authHeader) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Adjust a date forward so it never lands on Saturday/Sunday.
 * Saturday → Monday (+2), Sunday → Monday (+1).
 */
export function adjustToBusinessDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  return d;
}

/**
 * Adjust a YYYY-MM-DD string to the next business day, returning an ISO string
 * fixed to 23:59:59Z (matches the legacy due_date format).
 */
export function adjustDueDateToBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + "T23:59:59Z");
  const day = d.getUTCDay();
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString();
}

/**
 * Compute a due_date that is N business days ahead of startDateStr, where N
 * is ceil(estimatedHours / 8). Weekends are skipped.
 */
export function calculateBusinessDueDate(startDateStr: string, estimatedHours: number): string {
  const hoursPerDay = 8;
  let businessDays = Math.ceil(estimatedHours / hoursPerDay);
  if (businessDays < 1) businessDays = 1;

  const d = new Date(startDateStr + "T23:59:59Z");
  let added = 0;
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString();
}

/**
 * Compute the next run date (YYYY-MM-DD) from a current date and frequency.
 * Always returns a business day (weekends shifted to Monday).
 */
export function calculateNextRunDate(
  frequency: string,
  currentDate: string,
  weekdays: number[] | null,
  dayOfMonth: number | null,
): string {
  const current = new Date(currentDate + "T12:00:00Z");

  if (frequency === "daily") {
    current.setUTCDate(current.getUTCDate() + 1);
    return formatDate(adjustToBusinessDay(current));
  }

  if (frequency === "weekly") {
    if (!weekdays || weekdays.length === 0) {
      current.setUTCDate(current.getUTCDate() + 7);
      return formatDate(adjustToBusinessDay(current));
    }
    const sortedDays = [...weekdays].sort((a, b) => a - b);
    const currentDay = current.getUTCDay();
    const nextDay = sortedDays.find((d) => d > currentDay);
    if (nextDay !== undefined) {
      current.setUTCDate(current.getUTCDate() + (nextDay - currentDay));
    } else {
      const diff = 7 - currentDay + sortedDays[0];
      current.setUTCDate(current.getUTCDate() + diff);
    }
    return formatDate(adjustToBusinessDay(current));
  }

  if (frequency === "biweekly") {
    if (!weekdays || weekdays.length === 0) {
      current.setUTCDate(current.getUTCDate() + 14);
      return formatDate(adjustToBusinessDay(current));
    }
    const sortedDays = [...weekdays].sort((a, b) => a - b);
    const currentDay = current.getUTCDay();
    const twoWeeksLater = new Date(current);
    twoWeeksLater.setUTCDate(twoWeeksLater.getUTCDate() + 14 - currentDay);
    for (const wd of sortedDays) {
      const candidate = new Date(twoWeeksLater);
      candidate.setUTCDate(candidate.getUTCDate() + wd);
      if (candidate > current) {
        return formatDate(adjustToBusinessDay(candidate));
      }
    }
    current.setUTCDate(current.getUTCDate() + 14);
    return formatDate(adjustToBusinessDay(current));
  }

  if (frequency === "monthly") {
    const day = dayOfMonth || current.getUTCDate();
    // Anchor to day 1 BEFORE advancing the month to avoid JS Date overflow
    // (e.g. Jan 31 + 1 month would otherwise roll into March).
    current.setUTCDate(1);
    current.setUTCMonth(current.getUTCMonth() + 1);
    const maxDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
    current.setUTCDate(Math.min(day, maxDay));
    return formatDate(adjustToBusinessDay(current));
  }

  if (frequency === "yearly") {
    // Advance exactly one year, preserving month/day (clamped to month length).
    const anchorMonth = current.getUTCMonth();
    const anchorDay = current.getUTCDate();
    current.setUTCDate(1);
    current.setUTCFullYear(current.getUTCFullYear() + 1);
    current.setUTCMonth(anchorMonth);
    const maxDay = new Date(Date.UTC(current.getUTCFullYear(), anchorMonth + 1, 0)).getUTCDate();
    current.setUTCDate(Math.min(anchorDay, maxDay));
    return formatDate(adjustToBusinessDay(current));
  }

  // Fallback
  current.setUTCDate(current.getUTCDate() + 1);
  return formatDate(adjustToBusinessDay(current));
}
