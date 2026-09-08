import {
  KanbanSnapshot,
  SnapshotColumn,
  SnapshotDemandInput,
  buildKanbanSnapshot,
  formatSnapshotDate,
} from "@/lib/kanbanSnapshot";

/**
 * Project (folder) snapshot: the same Kanban blocks, but organized by the
 * boards the project's demands belong to, plus a consolidated overview.
 */

export interface ProjectBoardInput {
  boardId: string;
  boardName: string;
  columns: SnapshotColumn[];
  demands: SnapshotDemandInput[];
}

export interface ProjectSnapshot {
  projectName: string;
  authorName: string;
  scopeLabel: string;
  generatedAt: Date;
  overall: KanbanSnapshot;
  boards: Array<{ boardId: string; boardName: string; snapshot: KanbanSnapshot }>;
}

export function buildProjectSnapshot(params: {
  projectName: string;
  authorName: string;
  scopeLabel: string;
  boards: ProjectBoardInput[];
}): ProjectSnapshot {
  const { projectName, authorName, scopeLabel, boards } = params;

  const boardSnapshots = boards
    .slice()
    .sort((a, b) => a.boardName.localeCompare(b.boardName))
    .map((b) => ({
      boardId: b.boardId,
      boardName: b.boardName,
      snapshot: buildKanbanSnapshot({
        boardName: b.boardName,
        authorName,
        scopeLabel,
        columns: b.columns,
        demands: b.demands,
      }),
    }));

  // Consolidated view: all demands, columns merged by stage name (order kept).
  const mergedColumns: SnapshotColumn[] = [];
  const seen = new Set<string>();
  boards.forEach((b) =>
    b.columns.forEach((c) => {
      if (!seen.has(c.label)) {
        seen.add(c.label);
        mergedColumns.push({ key: c.label, label: c.label, color: c.color });
      }
    })
  );

  // For the consolidated view each demand carries the stage label resolved
  // against its own board, so stages match across boards.
  const allDemands: SnapshotDemandInput[] = boards.flatMap((b) => {
    const byId = new Map(b.columns.filter((c) => c.statusId).map((c) => [c.statusId as string, c]));
    return b.demands.map((d) => {
      const col = (d.status_id && byId.get(d.status_id)) || undefined;
      const label = col?.label || d.demand_statuses?.name;
      return label ? { ...d, demand_statuses: { name: label } } : d;
    });
  });

  const overall = buildKanbanSnapshot({
    boardName: projectName,
    authorName,
    scopeLabel,
    columns: mergedColumns,
    demands: allDemands,
  });

  return {
    projectName,
    authorName,
    scopeLabel,
    generatedAt: new Date(),
    overall,
    boards: boardSnapshots,
  };
}

function csvBlocks(snapshot: KanbanSnapshot, out: string[], line: (c: (string | number)[]) => string) {
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
  out.push("");
}

export function projectSnapshotToCSV(snapshot: ProjectSnapshot): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const line = (cells: (string | number)[]) => cells.map(esc).join(",");
  const out: string[] = [];

  out.push(line([`Resumo do Projeto — ${snapshot.projectName}`]));
  out.push(line([`Gerado em ${snapshot.generatedAt.toLocaleString("pt-BR")}`]));
  out.push(line([`Escopo: ${snapshot.scopeLabel}`]));
  out.push(line([`Gerado por: ${snapshot.authorName}`]));
  out.push(line([`Quadros no projeto: ${snapshot.boards.length}`]));
  out.push("");

  out.push(line(["=== CONSOLIDADO DO PROJETO ==="]));
  csvBlocks(snapshot.overall, out, line);

  out.push(line(["=== POR QUADRO ==="]));
  out.push(line(["Quadro", "Demandas", "Entregues", "Atrasadas", "Vencem em 7 dias"]));
  snapshot.boards.forEach((b) =>
    out.push(
      line([
        b.boardName,
        b.snapshot.overview.total,
        b.snapshot.overview.delivered,
        b.snapshot.overview.overdue,
        b.snapshot.overview.dueSoon,
      ])
    )
  );
  out.push("");

  snapshot.boards.forEach((b) => {
    out.push(line([`=== QUADRO: ${b.boardName} ===`]));
    csvBlocks(b.snapshot, out, line);
  });

  return out.join("\n");
}
