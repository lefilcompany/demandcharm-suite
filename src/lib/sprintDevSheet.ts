/**
 * Ficha de desenvolvedor da sprint: monta o changelog (diffs) e as métricas
 * a partir de registros reais. Nada é inventado: sem histórico, só estado final.
 */
export type DiffKind = "added" | "carried" | "delivered" | "stage" | "due_change";

export interface DiffEvent {
  kind: DiffKind;
  at: string; // ISO
  code: string;
  title: string;
  detail: string;
}

export interface DevSheetDemand {
  id: string;
  code: string;
  title: string;
  stage: string;
  isDelivered: boolean;
  deliveredAt: string | null;
  dueDate: string | null;
  statusChangedAt: string | null;
  effort: number | null;
  responsible: string;
}

export interface DevSheetInput {
  sprint: { start_date: string; end_date: string };
  demands: DevSheetDemand[];
  addedAt: Record<string, string | undefined>;
  carriedIds: Set<string>;
  dueChanges: Array<{ demand_id: string; previous_due_date: string | null; new_due_date: string | null; created_at: string; changed_by_name?: string | null }>;
  secondsByDemand: Record<string, number>;
}

export const DIFF_SYMBOL: Record<DiffKind, string> = {
  added: "+",
  carried: "<",
  delivered: "OK",
  stage: "->",
  due_change: "~",
};

const d10 = (v: string | null | undefined) => (v ? v.substring(0, 10) : null);
export const fmtDay = (v: string | null | undefined) => {
  const s = d10(v);
  return s ? s.split("-").reverse().join("/") : "—";
};

/** Entregue no prazo quando a data de entrega (dia) <= prazo (dia). */
export function deliveredOnTime(deliveredAt: string | null, dueDate: string | null): boolean | null {
  const a = d10(deliveredAt), b = d10(dueDate);
  if (!a || !b) return null;
  return a <= b;
}

function inPeriod(at: string | null | undefined, start: string, end: string) {
  const s = d10(at);
  return !!s && s >= start.substring(0, 10) && s <= end.substring(0, 10);
}

export function buildDiffEvents(input: DevSheetInput): DiffEvent[] {
  const { sprint } = input;
  const byId = new Map(input.demands.map((d) => [d.id, d]));
  const events: DiffEvent[] = [];
  for (const d of input.demands) {
    const added = input.addedAt[d.id];
    if (input.carriedIds.has(d.id)) {
      events.push({ kind: "carried", at: added ?? sprint.start_date, code: d.code, title: d.title, detail: "Veio da sprint anterior" });
    } else if (added) {
      events.push({ kind: "added", at: added, code: d.code, title: d.title, detail: "Entrou na sprint" });
    }
    if (d.isDelivered && d.deliveredAt) {
      const ok = deliveredOnTime(d.deliveredAt, d.dueDate);
      events.push({
        kind: "delivered", at: d.deliveredAt, code: d.code, title: d.title,
        detail: `Entregue em ${fmtDay(d.deliveredAt)}${ok === null ? "" : ok ? " · no prazo" : " · atrasada"}`,
      });
    } else if (d.statusChangedAt && inPeriod(d.statusChangedAt, sprint.start_date, sprint.end_date)) {
      events.push({ kind: "stage", at: d.statusChangedAt, code: d.code, title: d.title, detail: `Agora em "${d.stage}"` });
    }
  }
  for (const c of input.dueChanges) {
    const d = byId.get(c.demand_id);
    if (!d || !inPeriod(c.created_at, sprint.start_date, sprint.end_date)) continue;
    events.push({
      kind: "due_change", at: c.created_at, code: d.code, title: d.title,
      detail: `Prazo ${fmtDay(c.previous_due_date)} -> ${fmtDay(c.new_due_date)}${c.changed_by_name ? ` (${c.changed_by_name})` : ""}`,
    });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export interface DevSheetMetrics {
  total: number;
  delivered: number;
  pending: number;
  overdue: number;
  deliveredLate: number;
  completionPct: number;
  effortPlanned: number;
  effortDelivered: number;
  hours: number;
  byPerson: Array<{ name: string; total: number; delivered: number; hours: number }>;
}

export function buildDevSheetMetrics(input: DevSheetInput, today = new Date().toISOString()): DevSheetMetrics {
  const t = today.substring(0, 10);
  const ds = input.demands;
  const delivered = ds.filter((d) => d.isDelivered);
  const people = new Map<string, { name: string; total: number; delivered: number; hours: number }>();
  let seconds = 0;
  for (const d of ds) {
    const s = input.secondsByDemand[d.id] ?? 0;
    seconds += s;
    const p = people.get(d.responsible) ?? { name: d.responsible, total: 0, delivered: 0, hours: 0 };
    p.total++;
    if (d.isDelivered) p.delivered++;
    p.hours += s / 3600;
    people.set(d.responsible, p);
  }
  return {
    total: ds.length,
    delivered: delivered.length,
    pending: ds.length - delivered.length,
    overdue: ds.filter((d) => !d.isDelivered && !!d.dueDate && d.dueDate.substring(0, 10) < t).length,
    deliveredLate: delivered.filter((d) => deliveredOnTime(d.deliveredAt, d.dueDate) === false).length,
    completionPct: ds.length ? Math.round((delivered.length / ds.length) * 100) : 0,
    effortPlanned: ds.reduce((a, d) => a + (d.effort ?? 0), 0),
    effortDelivered: delivered.reduce((a, d) => a + (d.effort ?? 0), 0),
    hours: Math.round((seconds / 3600) * 10) / 10,
    byPerson: [...people.values()]
      .map((p) => ({ ...p, hours: Math.round(p.hours * 10) / 10 }))
      .sort((a, b) => b.total - a.total),
  };
}

export interface CapabilityGroup {
  service: string;
  items: Array<{ text: string; codes: string[] }>;
}
