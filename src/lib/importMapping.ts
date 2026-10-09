export const EFFORT_SCALE = [1, 2, 3, 5, 8, 13, 21] as const;
export type PriorityCode = "P0" | "P1" | "P2";

/** P0 → alta, P1 → média, P2 → baixa; sem código → média. */
export function priorityFromCode(code?: string | null): "alta" | "média" | "baixa" {
  const c = (code ?? "").toUpperCase().trim();
  if (c === "P0") return "alta";
  if (c === "P2") return "baixa";
  return "média";
}

export function codeFromPriority(p: string): PriorityCode {
  if (p === "alta" || p === "urgente") return "P0";
  if (p === "baixa") return "P2";
  return "P1";
}

/** Arredonda qualquer valor para o ponto mais próximo da escala Fibonacci do SoMA (padrão 3). */
export function snapEffort(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return EFFORT_SCALE.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), EFFORT_SCALE[0]);
}
