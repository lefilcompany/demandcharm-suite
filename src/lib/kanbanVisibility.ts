export const KANBAN_DELIVERED_RETENTION_DAYS = 31;

interface DemandLike {
  delivered_at?: string | null;
  demand_statuses?: { name?: string | null } | null;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.substring(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Entregue há mais de 31 dias, ou entregue antes da última limpeza do quadro → fora do Kanban. */
export function isHiddenFromKanban(d: DemandLike, clearedAt: string | null | undefined, today = localToday()): boolean {
  if (!d.delivered_at) return false;
  if (d.demand_statuses?.name && d.demand_statuses.name !== "Entregue") return false;
  if (dayNumber(today) - dayNumber(d.delivered_at) > KANBAN_DELIVERED_RETENTION_DAYS) return true;
  if (clearedAt && new Date(d.delivered_at).getTime() <= new Date(clearedAt).getTime()) return true;
  return false;
}
