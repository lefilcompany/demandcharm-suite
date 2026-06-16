import { addHours, addDays, isSaturday, isSunday, format, getYear, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Get Brazilian national holidays for a given year
 * Includes fixed holidays and calculates Easter-based holidays
 */
const getBrazilianHolidays = (year: number): Date[] => {
  // Calculate Easter Sunday using Anonymous Gregorian algorithm
  const calculateEaster = (y: number): Date => {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month, day);
  };

  const easter = calculateEaster(year);
  
  // Easter-based holidays
  const carnival = addDays(easter, -47); // Carnaval (terça-feira)
  const carnivalMonday = addDays(easter, -48); // Segunda de Carnaval
  const goodFriday = addDays(easter, -2); // Sexta-feira Santa
  const corpusChristi = addDays(easter, 60); // Corpus Christi

  // Fixed national holidays
  const holidays: Date[] = [
    new Date(year, 0, 1),   // Ano Novo
    carnivalMonday,         // Segunda de Carnaval
    carnival,               // Terça de Carnaval
    goodFriday,             // Sexta-feira Santa
    new Date(year, 3, 21),  // Tiradentes
    new Date(year, 4, 1),   // Dia do Trabalho
    corpusChristi,          // Corpus Christi
    new Date(year, 8, 7),   // Independência do Brasil
    new Date(year, 9, 12),  // Nossa Senhora Aparecida
    new Date(year, 10, 2),  // Finados
    new Date(year, 10, 15), // Proclamação da República
    new Date(year, 11, 25), // Natal
  ];

  return holidays;
};

/**
 * Check if a date is a Brazilian national holiday
 */
const isHoliday = (date: Date): boolean => {
  const year = getYear(date);
  const holidays = getBrazilianHolidays(year);
  
  return holidays.some(holiday => 
    holiday.getFullYear() === date.getFullYear() &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getDate() === date.getDate()
  );
};

/**
 * Check if a date is a business day (not weekend and not holiday)
 */
const isBusinessDay = (date: Date): boolean => {
  return !isSaturday(date) && !isSunday(date) && !isHoliday(date);
};

/**
 * Move date to next business day if it falls on weekend or holiday
 */
export const getNextBusinessDay = (date: Date): Date => {
  let result = date;
  while (!isBusinessDay(result)) {
    result = addDays(result, 1);
  }
  return result;
};

/**
 * Calculate due date based on estimated hours, ensuring it falls on a business day
 */
export const calculateBusinessDueDate = (estimatedHours: number): Date => {
  const dueDate = addHours(new Date(), estimatedHours);
  return getNextBusinessDay(dueDate);
};

/**
 * Format a due date for display (dd/MM/yyyy HH:mm)
 */
export const formatDueDate = (date: Date): string => {
  return format(date, "dd/MM/yyyy HH:mm");
};

/**
 * Format a due date for form input (yyyy-MM-dd)
 */
export const formatDueDateForInput = (date: Date): string => {
  return format(date, "yyyy-MM-dd");
};

/**
 * Extract the date-only portion (YYYY-MM-DD) from an ISO timestamp string.
 * This avoids timezone conversion issues by working with the string directly.
 * NOTE: Use toLocalDateString() for user-facing displays that need local timezone.
 */
export const toDateOnly = (isoString: string | null | undefined): string | null => {
  if (!isoString) return null;
  // Handle both "2026-01-14T00:00:00Z" and "2026-01-14 00:00:00+00" formats
  return isoString.slice(0, 10);
};

/**
 * Convert an ISO timestamp to local date string (YYYY-MM-DD)
 * considering the user's device timezone.
 * 
 * Example: "2026-01-30T01:30:00Z" in Brazil (UTC-3) -> "2026-01-29"
 * 
 * This is the preferred function for user-facing date displays in charts
 * and dashboards where the user expects dates relative to their timezone.
 */
export const toLocalDateString = (isoString: string | null | undefined): string | null => {
  if (!isoString) return null;
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Parse a date-only string (YYYY-MM-DD) into a local Date object at midnight.
 * This ensures consistent display regardless of the user's timezone.
 */
export const parseDateOnly = (dateOnlyString: string | null | undefined): Date | null => {
  if (!dateOnlyString) return null;
  const [year, month, day] = dateOnlyString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format a date-only string or ISO timestamp to Brazilian format (dd/MM/yyyy).
 * Handles timezone issues by extracting the date portion first.
 */
export const formatDateOnlyBR = (isoString: string | null | undefined): string | null => {
  const dateOnly = toDateOnly(isoString);
  if (!dateOnly) return null;
  const date = parseDateOnly(dateOnly);
  if (!date) return null;
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

/**
 * Check if a due date is overdue (past), using date-only comparison.
 * This avoids timezone issues by comparing only the date portions.
 */
export const isDateOverdue = (isoString: string | null | undefined): boolean => {
  const dateOnly = toDateOnly(isoString);
  if (!dateOnly) return false;
  const dueDate = parseDateOnly(dateOnly);
  if (!dueDate) return false;
  const today = startOfDay(new Date());
  return dueDate < today;
};

/**
 * Determines whether a demand is "overdue" (atrasada).
 * Prefers the persisted `is_overdue` flag (kept up-to-date by trigger + daily cron),
 * falling back to a date comparison for safety.
 *
 * Important: a demand that has been delivered is NEVER considered "currently overdue".
 * Use `isDemandDeliveredLate` for the post-delivery state.
 */
export const isDemandOverdue = (demand: {
  is_overdue?: boolean | null;
  due_date?: string | null;
  delivered_at?: string | null;
  demand_statuses?: { name?: string } | null;
}): boolean => {
  const isDelivered =
    !!demand.delivered_at || demand.demand_statuses?.name === "Entregue";
  if (isDelivered) return false;
  if (typeof demand.is_overdue === "boolean") return demand.is_overdue;
  return isDateOverdue(demand.due_date);
};

/**
 * True when a demand has been delivered AFTER its due date ("entregue com atraso").
 */
export const isDemandDeliveredLate = (demand: {
  is_overdue?: boolean | null;
  due_date?: string | null;
  delivered_at?: string | null;
  demand_statuses?: { name?: string } | null;
}): boolean => {
  const isDelivered =
    !!demand.delivered_at || demand.demand_statuses?.name === "Entregue";
  if (!isDelivered) return false;
  if (typeof demand.is_overdue === "boolean") return demand.is_overdue;
  if (!demand.due_date || !demand.delivered_at) return false;
  return new Date(demand.delivered_at) > new Date(demand.due_date);
};
