import { TEAM_COST_TYPES, TeamCostType } from "./projectShare";

export type CostRow = { cost_type: TeamCostType; monthly_amount: number | string; valid_from: string; updated_at: string };
export type CostChange = { type: TeamCostType; validFrom: string; amount: number; previous: number | null; changedAt: string };

/** Value in force each month of `year` (latest valid_from <= month) and the ordered change list. */
export function buildCostHistory(rows: CostRow[], year: number) {
  const sorted = [...rows].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  const last: Partial<Record<TeamCostType, number>> = {};
  const changes: CostChange[] = sorted.map((r) => {
    const amount = Number(r.monthly_amount);
    const c = { type: r.cost_type, validFrom: r.valid_from.substring(0, 10), amount, previous: last[r.cost_type] ?? null, changedAt: r.updated_at };
    last[r.cost_type] = amount;
    return c;
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const values = {} as Record<TeamCostType, number>;
    const changed: TeamCostType[] = [];
    for (const t of TEAM_COST_TYPES) {
      const hit = sorted.filter((r) => r.cost_type === t && r.valid_from.substring(0, 10) <= month).pop();
      values[t] = hit ? Number(hit.monthly_amount) : 0;
      if (hit && hit.valid_from.substring(0, 7) === month.substring(0, 7)) changed.push(t);
    }
    return { month, values, changed, total: TEAM_COST_TYPES.reduce((s, t) => s + values[t], 0) };
  });
  return { months, changes, yearTotal: months.reduce((s, m) => s + m.total, 0) };
}
