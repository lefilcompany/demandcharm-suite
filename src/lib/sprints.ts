export type SprintStatus = "planned" | "active" | "completed";

export const SPRINT_STATUS_LABEL: Record<SprintStatus, string> = {
  planned: "Planejada",
  active: "Ativa",
  completed: "Concluída",
};

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.substring(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Dias restantes até o fim (inclusive o dia do fim). Negativo = encerrada há N dias. */
export function sprintDaysRemaining(endDate: string, today = todayIso()): number {
  return dayNumber(endDate) - dayNumber(today);
}

export function formatDaysRemaining(endDate: string, today = todayIso()): string {
  const d = sprintDaysRemaining(endDate, today);
  if (d > 1) return `${d} dias restantes`;
  if (d === 1) return "Termina amanhã";
  if (d === 0) return "Termina hoje";
  return `Encerrada há ${-d} dia${d === -1 ? "" : "s"}`;
}

interface DemandLike {
  delivered_at?: string | null;
  due_date?: string | null;
}

export function sprintProgress(demands: DemandLike[], today = todayIso()) {
  const total = demands.length;
  const delivered = demands.filter((d) => !!d.delivered_at).length;
  const overdue = demands.filter(
    (d) => !d.delivered_at && !!d.due_date && dayNumber(d.due_date) < dayNumber(today)
  ).length;
  return { total, delivered, overdue, percent: total ? Math.round((delivered / total) * 100) : 0 };
}

/** Uma demanda só pode estar em uma sprint não concluída por vez. */
export function canAddDemandToSprint(
  demandId: string,
  targetSprintId: string,
  memberships: { demand_id: string; sprint_id: string; sprint_status: SprintStatus }[]
): boolean {
  return !memberships.some(
    (m) => m.demand_id === demandId && m.sprint_id !== targetSprintId && m.sprint_status !== "completed"
  );
}

/**
 * Ao remover uma etapa do Kanban da sprint, as demandas vão para a próxima etapa visível.
 * Retorna null quando não há etapa seguinte (a última etapa não pode ser removida).
 */
export function nextStageAfter<T extends { statusId?: string }>(visible: T[], statusId: string): T | null {
  const i = visible.findIndex((c) => c.statusId === statusId);
  if (i === -1 || i === visible.length - 1) return null;
  return visible[i + 1];
}
