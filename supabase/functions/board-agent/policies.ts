// Pure, runtime-independent rules shared by tools and their tests.
export const WRITE_TOOLS = ["create_demand", "update_demand", "create_follow_up", "bulk_update_demands", "apply_sprint_plan"] as const;
export function canWrite(role: string | null | undefined) {
  return role === "admin" || role === "moderator" || role === "executor";
}
export function titleSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const x = words(a), y = words(b);
  const union = new Set([...x, ...y]);
  return union.size ? [...x].filter(w => y.has(w)).length / union.size : 0;
}
export function selectSprintCandidates<T extends { id: string; effort_points: number | null; priority: string | null; due_on: string | null }>(rows: T[], unavailable: Set<string>, budget: number, end: string) {
  const rank: Record<string, number> = { urgente: 4, alta: 3, "média": 2, baixa: 1 };
  const sorted = rows.filter(r => !unavailable.has(r.id)).sort((a, b) =>
    (rank[b.priority ?? ""] ?? 0) - (rank[a.priority ?? ""] ?? 0) || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
  let planned = 0;
  const selected: T[] = [], missingEffort: T[] = [];
  for (const row of sorted) {
    if (row.effort_points == null || row.effort_points <= 0) { missingEffort.push(row); continue; }
    if (planned + row.effort_points > budget || (row.due_on && row.due_on > end)) continue;
    selected.push(row); planned += row.effort_points;
  }
  return { selected, planned_points: planned, missing_effort: missingEffort };
}