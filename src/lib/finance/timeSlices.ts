// Pure mirror of SQL `_finance_time_slices` + display helpers for project hours/costs.
// Rules: hours belong to the month they were worked (America/Sao_Paulo); overlapping
// timers of the same person count once (shared equally between entries).

export interface RawEntry { id: string; userId: string; start: number; end: number | null }
export interface Slice { id: string; userId: string; hours: number; rawHours: number; split: boolean; running: boolean; overlapped: boolean }

const H = 3_600_000;

/** Month bounds in UTC ms for a competence "YYYY-MM-01" in São Paulo (UTC-3, no DST). */
export function monthBounds(competence: string): [number, number] {
  const [y, m] = competence.substring(0, 7).split("-").map(Number);
  return [Date.UTC(y, m - 1, 1, 3), Date.UTC(y, m, 1, 3)];
}

export function sliceEntries(entries: RawEntry[], competence: string, now = Date.now()): Slice[] {
  const [ms, me] = monthBounds(competence);
  const clipped = entries
    .map((e) => {
      const end = e.end ?? now;
      return { ...e, s: Math.max(e.start, ms), f: Math.min(end, me), split: e.start < ms || end > me, running: e.end === null };
    })
    .filter((e) => e.f > e.s);
  const share = new Map<string, number>();
  const over = new Set<string>();
  const users = new Set(clipped.map((e) => e.userId));
  for (const u of users) {
    const mine = clipped.filter((e) => e.userId === u);
    const pts = [...new Set(mine.flatMap((e) => [e.s, e.f]))].sort((a, b) => a - b);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], z = pts[i + 1];
      const cov = mine.filter((e) => e.s <= a && e.f >= z);
      for (const e of cov) {
        share.set(e.id, (share.get(e.id) ?? 0) + (z - a) / cov.length);
        if (cov.length > 1) over.add(e.id);
      }
    }
  }
  return clipped.map((e) => ({
    id: e.id, userId: e.userId, hours: (share.get(e.id) ?? 0) / H, rawHours: (e.f - e.s) / H,
    split: e.split, running: e.running, overlapped: over.has(e.id),
  }));
}

/** Cost of a person: null (missing) when there is no hourly cost — never silently zero. */
export function personCost(hours: number, hourlyCost: number | null | undefined): number | null {
  if (hourlyCost === null || hourlyCost === undefined) return hours > 0 ? null : 0;
  return Math.round(hours * hourlyCost * 100) / 100;
}

export const KIND_LABEL: Record<string, string> = { internal: "Interno", client_external: "Cliente externo", contractor: "Prestador" };
export const kindLabel = (k: string | null | undefined) => (k ? KIND_LABEL[k] ?? k : "Sem vínculo");

export const fmtHours = (h: number) => {
  const m = Math.round((h || 0) * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

export interface HoursCostsReport {
  competence: string;
  can_see_people: boolean;
  summary: {
    internal_hours: number; client_external_hours: number; contractor_hours: number; unclassified_hours: number;
    personnel_cost: number; missing_cost_people: number; missing_cost_hours: number; people_count: number; pending_hours: number;
  };
  people: { user_id: string; name: string; kind: string | null; hours: number; hourly_cost: number | null; cost: number | null }[] | null;
  audit: { overlap_entries: number; overlap_hours_removed: number; split_entries: number; running_entries: number };
  expenses: { direct: number; fixa: number; operacional: number; administrativa: number; team_unallocated: number };
}

export function hoursCostsCsv(r: HoursCostsReport): string {
  const rows: (string | number)[][] = [["Mês", r.competence.substring(0, 7)], [],
    ["Horas internas", r.summary.internal_hours], ["Horas cliente externo", r.summary.client_external_hours],
    ["Horas prestador", r.summary.contractor_hours], ["Horas sem vínculo", r.summary.unclassified_hours],
    ["Custo de pessoal", r.summary.personnel_cost], ["Pessoas sem custo", r.summary.missing_cost_people],
    ["Horas pendentes (sem projeto)", r.summary.pending_hours], [],
    ["Despesa direta", r.expenses.direct], ["Rateio fixa", r.expenses.fixa], ["Rateio operacional", r.expenses.operacional],
    ["Rateio administrativa", r.expenses.administrativa]];
  if (r.people?.length) {
    rows.push([], ["Pessoa", "Vínculo", "Horas", "Custo/hora", "Custo"]);
    for (const p of r.people) rows.push([p.name, kindLabel(p.kind), p.hours, p.hourly_cost ?? "faltante", p.cost ?? "faltante"]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}
