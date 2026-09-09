/**
 * Score de prioridade = (Esforço x Nível de prioridade) / Tempo
 *
 * - Esforço: valor Fibonacci convertido em multiplicador
 * - Nível de prioridade: 4^0 (baixa), 4^1 (média), 4^2 (alta), 4^3 (urgente)
 * - Tempo: prazo de entrega em segundos (created_at -> due_date)
 *
 * Quanto maior o score, mais alta a demanda fica na fila.
 */

export const EFFORT_OPTIONS = [1, 2, 3, 5, 8, 13, 21] as const;
export type EffortPoints = (typeof EFFORT_OPTIONS)[number];

export const DEFAULT_EFFORT: EffortPoints = 5;

export const EFFORT_MULTIPLIERS: Record<number, number> = {
  1: 0.5,
  2: 0.6,
  3: 0.8,
  5: 1.0,
  8: 1.3,
  13: 1.7,
  21: 2.0,
};

export const PRIORITY_LEVELS: Record<string, number> = {
  baixa: 1, // 4^0
  media: 4, // 4^1
  média: 4,
  alta: 16, // 4^2
  urgente: 64, // 4^3
};

export function getEffortMultiplier(effort?: number | null): number {
  return EFFORT_MULTIPLIERS[effort ?? DEFAULT_EFFORT] ?? 1.0;
}

export function getPriorityLevel(priority?: string | null): number {
  const key = (priority || "média").toLowerCase().trim();
  return PRIORITY_LEVELS[key] ?? 4;
}

export interface ScorableDemand {
  priority?: string | null;
  effort_points?: number | null;
  due_date?: string | null;
  created_at?: string | null;
}

/** Retorna o score de prioridade. Demandas sem prazo recebem 0 (ficam no fim). */
export function getPriorityScore(demand: ScorableDemand): number {
  if (!demand.due_date) return 0;

  const due = new Date(demand.due_date).getTime();
  const created = demand.created_at ? new Date(demand.created_at).getTime() : NaN;
  if (Number.isNaN(due) || Number.isNaN(created)) return 0;

  // Tempo do ciclo em segundos; mínimo de 1 dia para evitar divisão por zero.
  const seconds = Math.max((due - created) / 1000, 86400);

  return (getEffortMultiplier(demand.effort_points) * getPriorityLevel(demand.priority)) / seconds;
}
