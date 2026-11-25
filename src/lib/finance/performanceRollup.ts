// Groups project finance by the project's fixed performance; each project counts in exactly one group.
import { projectResult, type ProjectMonth } from "./projectRollup";

export interface PerfProjectInput { project_id: string; name: string; months: ProjectMonth[]; performance_id: string | null; active: boolean }
export interface PerfInfo { id: string; name: string; color: string }

export const NO_PERFORMANCE = "__none__";

export function rollupByPerformance(projects: PerfProjectInput[], perfs: PerfInfo[]) {
  const byId = new Map(perfs.map((p) => [p.id, p]));
  const groups = new Map<string, PerfProjectInput[]>();
  projects.forEach((p) => {
    const k = p.performance_id && byId.has(p.performance_id) ? p.performance_id : NO_PERFORMANCE;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  return [...groups.entries()].map(([id, list]) => {
    const info = byId.get(id);
    const r = projectResult(list.flatMap((p) => p.months));
    return {
      id, name: info?.name ?? "Sem performance", color: info?.color ?? "hsl(var(--muted-foreground))",
      projectCount: list.length, activeCount: list.filter((p) => p.active).length,
      r, projects: list.map((p) => ({ ...p, r: projectResult(p.months) })),
    };
  }).sort((a, b) => b.r.result - a.r.result);
}
