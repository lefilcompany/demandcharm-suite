import { formatDemandCode } from "@/lib/demandCodeUtils";

/**
 * Builds an aggregated snapshot of a board's Kanban from data already loaded
 * on screen. No extra network calls: everything comes from the demands list
 * and the visible columns.
 */

export interface SnapshotColumn {
  key: string;
  label: string;
  color?: string;
  statusId?: string;
}

export interface SnapshotDemandInput {
  id: string;
  title: string;
  board_sequence_number?: number | null;
  status_id?: string | null;
  priority?: string | null;
  due_date?: string | null;
  delivered_at?: string | null;
  is_overdue?: boolean | null;
  parent_demand_id?: string | null;
  demand_statuses?: { name?: string | null } | null;
  services?: { name?: string | null } | null;
  assigned_profile?: { full_name?: string | null } | null;
  demand_assignees?: Array<{
    user_id: string;
    is_primary?: boolean | null;
    profile?: { full_name?: string | null } | null;
  }> | null;
}

export const NO_ASSIGNEE = "Sem responsável";
const NO_STAGE = "Sem etapa";

export interface SnapshotRow {
  id: string;
  code: string;
  title: string;
  stage: string;
  stageColor?: string;
  responsible: string;
  followers: string[];
  priority: string;
  service: string;
  dueDate: string | null;
  daysLate: number;
  isOverdue: boolean;
  isDelivered: boolean;
  isSubdemand: boolean;
}

export interface SnapshotStageGroup {
  key: string;
  label: string;
  color?: string;
  count: number;
  share: number;
  overdue: number;
  rows: SnapshotRow[];
}

export interface SnapshotPersonRow {
  name: string;
  total: number;
  delivered: number;
  overdue: number;
  dueSoon: number;
  byStage: Record<string, number>;
}

export interface KanbanSnapshot {
  boardName: string;
  generatedAt: Date;
  scopeLabel: string;
  authorName: string;
  overview: {
    total: number;
    delivered: number;
    inProgress: number;
    overdue: number;
    dueSoon: number;
    people: number;
  };
  stages: SnapshotStageGroup[];
  people: SnapshotPersonRow[];
  rows: SnapshotRow[];
}

/** Dates are stored as ISO strings; take the date part to avoid timezone shifts. */
function toLocalDate(value: string): Date {
  const datePart = value.substring(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatSnapshotDate(value: string | null): string {
  if (!value) return "—";
  const d = toLocalDate(value);
  return d.toLocaleDateString("pt-BR");
}

export function priorityLabel(priority?: string | null): string {
  const map: Record<string, string> = {
    baixa: "Baixa",
    low: "Baixa",
    média: "Média",
    media: "Média",
    medium: "Média",
    alta: "Alta",
    high: "Alta",
    urgente: "Urgente",
    urgent: "Urgente",
  };
  if (!priority) return "Média";
  return map[priority.toLowerCase()] || priority;
}

function resolvePeople(demand: SnapshotDemandInput) {
  const assignees = demand.demand_assignees || [];
  const primary = assignees.find((a) => a.is_primary);
  const followers = assignees
    .filter((a) => !a.is_primary)
    .map((a) => a.profile?.full_name || "Sem nome");

  const responsible =
    primary?.profile?.full_name ||
    demand.assigned_profile?.full_name ||
    assignees[0]?.profile?.full_name ||
    NO_ASSIGNEE;

  return { responsible, followers };
}

export function buildKanbanSnapshot(params: {
  boardName: string;
  authorName: string;
  scopeLabel: string;
  columns: SnapshotColumn[];
  demands: SnapshotDemandInput[];
}): KanbanSnapshot {
  const { boardName, authorName, scopeLabel, columns, demands } = params;
  const today = startOfToday();
  const soonLimit = today.getTime() + 7 * DAY_MS;

  const stageByStatusId = new Map<string, SnapshotColumn>();
  const stageByName = new Map<string, SnapshotColumn>();
  columns.forEach((c) => {
    if (c.statusId) stageByStatusId.set(c.statusId, c);
    stageByName.set(c.key, c);
  });

  const rows: SnapshotRow[] = demands.map((d) => {
    const column =
      (d.status_id && stageByStatusId.get(d.status_id)) ||
      (d.demand_statuses?.name ? stageByName.get(d.demand_statuses.name) : undefined);

    const stage = column?.label || d.demand_statuses?.name || NO_STAGE;
    const isDelivered = !!d.delivered_at || stage === "Entregue";
    const { responsible, followers } = resolvePeople(d);

    let daysLate = 0;
    let isOverdue = false;
    if (d.due_date && !isDelivered) {
      const due = toLocalDate(d.due_date).getTime();
      if (due < today.getTime()) {
        isOverdue = true;
        daysLate = Math.round((today.getTime() - due) / DAY_MS);
      }
    }

    return {
      id: d.id,
      code: formatDemandCode(d.board_sequence_number),
      title: d.title,
      stage,
      stageColor: column?.color,
      responsible,
      followers,
      priority: priorityLabel(d.priority),
      service: d.services?.name || "—",
      dueDate: d.due_date ?? null,
      daysLate,
      isOverdue,
      isDelivered,
      isSubdemand: !!d.parent_demand_id,
    };
  });

  // Stage groups follow the board column order; unknown stages go last.
  const stages: SnapshotStageGroup[] = [];
  const pushStage = (key: string, label: string, color: string | undefined, stageRows: SnapshotRow[]) => {
    stages.push({
      key,
      label,
      color,
      count: stageRows.length,
      share: rows.length ? Math.round((stageRows.length / rows.length) * 100) : 0,
      overdue: stageRows.filter((r) => r.isOverdue).length,
      rows: stageRows,
    });
  };

  const used = new Set<string>();
  columns.forEach((c) => {
    const stageRows = rows.filter((r) => r.stage === c.label);
    stageRows.forEach((r) => used.add(r.id));
    pushStage(c.key, c.label, c.color, stageRows);
  });
  const leftovers = rows.filter((r) => !used.has(r.id));
  const leftoverStages = Array.from(new Set(leftovers.map((r) => r.stage)));
  leftoverStages.forEach((name) => {
    pushStage(name, name, undefined, leftovers.filter((r) => r.stage === name));
  });

  // People
  const peopleMap = new Map<string, SnapshotPersonRow>();
  rows.forEach((r) => {
    const entry = peopleMap.get(r.responsible) || {
      name: r.responsible,
      total: 0,
      delivered: 0,
      overdue: 0,
      dueSoon: 0,
      byStage: {},
    };
    entry.total += 1;
    if (r.isDelivered) entry.delivered += 1;
    if (r.isOverdue) entry.overdue += 1;
    if (!r.isDelivered && r.dueDate) {
      const due = toLocalDate(r.dueDate).getTime();
      if (due >= today.getTime() && due <= soonLimit) entry.dueSoon += 1;
    }
    entry.byStage[r.stage] = (entry.byStage[r.stage] || 0) + 1;
    peopleMap.set(r.responsible, entry);
  });

  const people = Array.from(peopleMap.values()).sort((a, b) => {
    if (a.name === NO_ASSIGNEE) return 1;
    if (b.name === NO_ASSIGNEE) return -1;
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    return b.total - a.total;
  });

  const delivered = rows.filter((r) => r.isDelivered).length;
  const overdue = rows.filter((r) => r.isOverdue).length;
  const dueSoon = rows.filter((r) => {
    if (r.isDelivered || !r.dueDate) return false;
    const due = toLocalDate(r.dueDate).getTime();
    return due >= today.getTime() && due <= soonLimit;
  }).length;

  return {
    boardName,
    generatedAt: new Date(),
    scopeLabel,
    authorName,
    overview: {
      total: rows.length,
      delivered,
      inProgress: rows.length - delivered,
      overdue,
      dueSoon,
      people: people.filter((p) => p.name !== NO_ASSIGNEE).length,
    },
    stages,
    people,
    rows,
  };
}

/** Spreadsheet export: the same blocks, one after the other, in a single CSV. */
export function snapshotToCSV(snapshot: KanbanSnapshot): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const line = (cells: (string | number)[]) => cells.map(esc).join(",");
  const out: string[] = [];

  out.push(line([`Resumo do Kanban — ${snapshot.boardName}`]));
  out.push(line([`Gerado em ${snapshot.generatedAt.toLocaleString("pt-BR")}`]));
  out.push(line([`Escopo: ${snapshot.scopeLabel}`]));
  out.push(line([`Gerado por: ${snapshot.authorName}`]));
  out.push("");

  out.push(line(["PANORAMA"]));
  out.push(line(["Total", "Entregues", "Em andamento", "Atrasadas", "Vencem em 7 dias", "Pessoas envolvidas"]));
  out.push(
    line([
      snapshot.overview.total,
      snapshot.overview.delivered,
      snapshot.overview.inProgress,
      snapshot.overview.overdue,
      snapshot.overview.dueSoon,
      snapshot.overview.people,
    ])
  );
  out.push("");

  out.push(line(["POR ETAPA"]));
  out.push(line(["Etapa", "Demandas", "Participação (%)", "Atrasadas"]));
  snapshot.stages.forEach((s) => out.push(line([s.label, s.count, s.share, s.overdue])));
  out.push("");

  out.push(line(["POR RESPONSÁVEL"]));
  out.push(line(["Responsável", "Total", "Entregues", "Atrasadas", "Vencem em 7 dias"]));
  snapshot.people.forEach((p) => out.push(line([p.name, p.total, p.delivered, p.overdue, p.dueSoon])));
  out.push("");

  out.push(line(["DEMANDAS"]));
  out.push(
    line(["Código", "Título", "Etapa", "Responsável", "Seguidores", "Prioridade", "Serviço", "Prazo", "Atraso (dias)"])
  );
  snapshot.stages.forEach((stage) => {
    stage.rows.forEach((r) => {
      out.push(
        line([
          r.code,
          r.isSubdemand ? `↳ ${r.title}` : r.title,
          r.stage,
          r.responsible,
          r.followers.join("; "),
          r.priority,
          r.service,
          formatSnapshotDate(r.dueDate),
          r.isOverdue ? r.daysLate : 0,
        ])
      );
    });
  });

  return out.join("\n");
}
