import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawHeader, drawFooter, sectionTitle, type SnapshotPdfMeta } from "@/lib/kanbanSnapshotPdf";
import { DIFF_SYMBOL, fmtDay, type CapabilityGroup, type DevSheetDemand, type DevSheetMetrics, type DiffEvent } from "@/lib/sprintDevSheet";
import { slugify } from "@/lib/snapshotXlsx";

const ORANGE: [number, number, number] = [242, 135, 5];
const GRAPHITE: [number, number, number] = [29, 29, 29];
const MUTED: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [228, 228, 228];
const TOP = 44;

export interface DevSheetPdfInput {
  meta: SnapshotPdfMeta;
  sprint: { name: string; period: string; status: string; goal: string | null };
  boardName: string;
  capabilities: CapabilityGroup[];
  events: DiffEvent[];
  metrics: DevSheetMetrics;
  demands: DevSheetDemand[];
  extra: Record<string, { service: string; priority: string }>;
}

function ensure(doc: jsPDF, y: number, need: number, meta: SnapshotPdfMeta) {
  const h = doc.internal.pageSize.getHeight();
  if (y + need > h - 18) {
    doc.addPage();
    drawHeader(doc, meta);
    return TOP;
  }
  return y;
}

const lastY = (doc: jsPDF, f: number) =>
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? f;

export function generateSprintDevSheetPDF(input: DevSheetPdfInput) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const { meta, metrics } = input;
  drawHeader(doc, meta);
  let y = TOP;

  // Ficha
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const info = [
    ["Sprint", input.sprint.name], ["Quadro", input.boardName], ["Período", input.sprint.period],
    ["Situação", input.sprint.status], ["Objetivo", input.sprint.goal || "—"],
  ];
  autoTable(doc, {
    startY: y, body: info, theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2, textColor: GRAPHITE },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 28, textColor: MUTED } },
    margin: { left: 14, right: 14, top: TOP },
  });
  y = lastY(doc, y) + 8;

  // O que agora é possível
  y = sectionTitle(doc, "O que agora é possível", y);
  if (!input.capabilities.length) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text("Nenhuma entrega nesta sprint.", 20, y + 2);
    y += 10;
  } else {
    for (const g of input.capabilities) {
      y = ensure(doc, y, 12, meta);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...ORANGE);
      doc.text(g.service, 20, y + 2);
      y += 6;
      for (const it of g.items) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRAPHITE);
        const txt = `${it.text}${it.codes.length ? `  (${it.codes.join(", ")})` : ""}`;
        const lines = doc.splitTextToSize(txt, w - 34) as string[];
        y = ensure(doc, y, lines.length * 4.4 + 2, meta);
        doc.setFillColor(...GRAPHITE);
        doc.circle(23, y + 0.6, 0.8, "F");
        doc.text(lines, 27, y + 1.6);
        y += lines.length * 4.4 + 1.5;
      }
      y += 2;
    }
    y += 4;
  }

  // Diffs
  y = ensure(doc, y, 20, meta);
  y = sectionTitle(doc, "Diffs da sprint", y);
  autoTable(doc, {
    startY: y,
    head: [["", "Data", "Demanda", "Mudança"]],
    body: input.events.length
      ? input.events.map((e) => [DIFF_SYMBOL[e.kind], fmtDay(e.at), `${e.code} ${e.title}`.trim(), e.detail])
      : [["", "", "Nenhuma mudança registrada no período", ""]],
    theme: "grid",
    headStyles: { fillColor: GRAPHITE, textColor: 255, fontSize: 8 },
    styles: { font: "courier", fontSize: 7.8, cellPadding: 1.6, textColor: GRAPHITE, lineColor: LINE },
    columnStyles: { 0: { cellWidth: 10, halign: "center", fontStyle: "bold" }, 1: { cellWidth: 22 }, 2: { cellWidth: 80 } },
    margin: { left: 14, right: 14, top: TOP },
    didDrawPage: () => drawHeader(doc, meta),
    didParseCell: (d) => {
      if (d.section !== "body" || d.column.index !== 0) return;
      const s = String(d.cell.raw);
      if (s === "+" || s === "OK") d.cell.styles.textColor = [22, 163, 74];
      else if (s === "~") d.cell.styles.textColor = ORANGE;
    },
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  y = lastY(doc, y) + 4;
  doc.text("+ entrou   < veio da sprint anterior   OK entregue   -> mudou de etapa   ~ prazo alterado", 14, y);
  y += 9;

  // Relatório
  y = ensure(doc, y, 40, meta);
  y = sectionTitle(doc, "Relatório", y);
  autoTable(doc, {
    startY: y,
    head: [["Total", "Entregues", "Pendentes", "Atrasadas", "Entregues c/ atraso", "Conclusão", "Esforço entregue", "Horas"]],
    body: [[metrics.total, metrics.delivered, metrics.pending, metrics.overdue, metrics.deliveredLate,
      `${metrics.completionPct}%`, `${metrics.effortDelivered} / ${metrics.effortPlanned} pts`, `${metrics.hours} h`].map(String)],
    theme: "grid",
    headStyles: { fillColor: ORANGE, textColor: 255, fontSize: 7.5, halign: "center" },
    styles: { fontSize: 9, halign: "center", lineColor: LINE, textColor: GRAPHITE },
    margin: { left: 14, right: 14, top: TOP },
    didDrawPage: () => drawHeader(doc, meta),
  });
  y = lastY(doc, y) + 4;
  autoTable(doc, {
    startY: y,
    head: [["Responsável", "Demandas", "Entregues", "Horas"]],
    body: metrics.byPerson.map((p) => [p.name, String(p.total), String(p.delivered), `${p.hours} h`]),
    theme: "striped",
    headStyles: { fillColor: GRAPHITE, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    margin: { left: 14, right: 14, top: TOP },
    didDrawPage: () => drawHeader(doc, meta),
  });
  y = lastY(doc, y) + 10;

  // Lista
  y = ensure(doc, y, 20, meta);
  y = sectionTitle(doc, "Lista de demandas", y);
  autoTable(doc, {
    startY: y,
    head: [["#", "Título", "Serviço", "Responsável", "Etapa", "Prior.", "Esf.", "Prazo", "Entrega"]],
    body: input.demands.map((d) => [
      d.code, d.title, input.extra[d.id]?.service ?? "—", d.responsible, d.stage,
      input.extra[d.id]?.priority ?? "—", d.effort ? String(d.effort) : "—", fmtDay(d.dueDate), fmtDay(d.deliveredAt),
    ]),
    theme: "grid",
    headStyles: { fillColor: GRAPHITE, textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 7.3, cellPadding: 1.4, lineColor: LINE, textColor: GRAPHITE },
    columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 48 }, 6: { cellWidth: 9, halign: "center" } },
    margin: { left: 14, right: 14, top: TOP },
    didDrawPage: () => drawHeader(doc, meta),
  });

  drawFooter(doc);
  doc.save(`ficha-sprint-${slugify(input.sprint.name) || "sprint"}-${new Date().toISOString().substring(0, 10)}.pdf`);
}
