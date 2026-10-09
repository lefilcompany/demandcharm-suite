import { KanbanSnapshot, formatSnapshotDate } from "@/lib/kanbanSnapshot";

/** Gera uma planilha Excel (.xlsx) com abas Panorama, Por etapa, Por responsável e Demandas. */
export async function downloadSnapshotXlsx(
  snapshot: KanbanSnapshot,
  opts: { title: string; fileName: string; extraInfo?: [string, string][] }
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const panorama: (string | number)[][] = [
    [opts.title],
    ["Quadro", snapshot.boardName],
    ...(opts.extraInfo ?? []),
    ["Gerado em", snapshot.generatedAt.toLocaleString("pt-BR")],
    ["Gerado por", snapshot.authorName],
    [],
    ["Total", "Entregues", "Em andamento", "Atrasadas", "Vencem em 7 dias", "Pessoas envolvidas"],
    [
      snapshot.overview.total, snapshot.overview.delivered, snapshot.overview.inProgress,
      snapshot.overview.overdue, snapshot.overview.dueSoon, snapshot.overview.people,
    ],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(panorama);
  ws1["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Panorama");

  const ws2 = XLSX.utils.aoa_to_sheet([
    ["Etapa", "Demandas", "Participação (%)", "Atrasadas"],
    ...snapshot.stages.map((s) => [s.label, s.count, s.share, s.overdue]),
  ]);
  ws2["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Por etapa");

  const ws3 = XLSX.utils.aoa_to_sheet([
    ["Responsável", "Total", "Entregues", "Atrasadas", "Vencem em 7 dias"],
    ...snapshot.people.map((p) => [p.name, p.total, p.delivered, p.overdue, p.dueSoon]),
  ]);
  ws3["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Por responsável");

  const rows = snapshot.stages.flatMap((stage) =>
    stage.rows.map((r) => [
      r.code, r.isSubdemand ? `↳ ${r.title}` : r.title, r.stage, r.responsible,
      r.followers.join("; "), r.priority, r.service, formatSnapshotDate(r.dueDate), r.isOverdue ? r.daysLate : 0,
    ])
  );
  const ws4 = XLSX.utils.aoa_to_sheet([
    ["Código", "Título", "Etapa", "Responsável", "Seguidores", "Prioridade", "Serviço", "Prazo", "Atraso (dias)"],
    ...rows,
  ]);
  ws4["!cols"] = [{ wch: 10 }, { wch: 50 }, { wch: 20 }, { wch: 24 }, { wch: 30 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Demandas");

  XLSX.writeFile(wb, opts.fileName);
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
