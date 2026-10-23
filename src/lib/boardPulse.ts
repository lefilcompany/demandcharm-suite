export interface PulseDemand {
  due_date?: string | null;
  delivered_at?: string | null;
  demand_statuses?: { name?: string | null } | null;
  assigned_to?: string | null;
  demand_assignees?: { user_id: string }[] | null;
}

const norm = (s?: string | null) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const isDelivered = (d: PulseDemand) => !!d.delivered_at || /entreg|conclu/.test(norm(d.demand_statuses?.name));
export const isPending = (d: PulseDemand) => !isDelivered(d) && /iniciar|solicit|pendente|backlog/.test(norm(d.demand_statuses?.name));

/** "today" is a YYYY-MM-DD local date string. */
export function computeBoardPulse(demands: PulseDemand[], today: string, userId?: string) {
  const month = today.substring(0, 7);
  let inProgress = 0, overdue = 0, deliveredMonth = 0, mine = 0, pending = 0, delivered = 0;
  for (const d of demands) {
    const done = isDelivered(d);
    if (done) {
      delivered++;
      if (d.delivered_at && d.delivered_at.substring(0, 7) === month) deliveredMonth++;
      continue;
    }
    if (isPending(d)) pending++;
    else inProgress++;
    if (d.due_date && d.due_date.substring(0, 10) < today) overdue++;
    if (userId && (d.assigned_to === userId || d.demand_assignees?.some((a) => a.user_id === userId))) mine++;
  }
  return { inProgress, overdue, deliveredMonth, mine, pending, delivered, open: inProgress + pending };
}
