import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { KanbanSnapshot, formatSnapshotDate } from "@/lib/kanbanSnapshot";

// SoMA+ brand
const ORANGE: [number, number, number] = [242, 135, 5];
const GRAPHITE: [number, number, number] = [29, 29, 29];
const MUTED: [number, number, number] = [110, 110, 110];
const DANGER: [number, number, number] = [220, 38, 38];
const LINE: [number, number, number] = [228, 228, 228];

const PRIORITY_FILL: Record<string, [number, number, number]> = {
  Baixa: [22, 163, 74],
  Média: [234, 179, 8],
  Alta: [220, 38, 38],
  Urgente: [153, 27, 27],
};

function hexToRgb(hex?: string): [number, number, number] {
  if (!hex) return ORANGE;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return ORANGE;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function drawHeader(
  doc: jsPDF,
  meta: { title: string; subtitle: string; generatedAt: Date; scopeLabel: string; authorName: string }
) {
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...GRAPHITE);
  doc.rect(0, 0, w, 30, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 30, w, 2, "F");

  // Brand mark
  doc.setFillColor(...ORANGE);
  doc.circle(20, 15, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("S+", 20, 17.5, { align: "center" });

  doc.setFontSize(15);
  doc.text(meta.title, 32, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(meta.subtitle, 32, 21);

  doc.setFontSize(8);
  doc.text(
    `${meta.generatedAt.toLocaleString("pt-BR")}  ·  ${meta.scopeLabel}`,
    w - 14,
    14,
    { align: "right" }
  );
  doc.text(`Gerado por ${meta.authorName}`, w - 14, 21, { align: "right" });
}

export function drawFooter(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text("SoMA+ · gestão de demandas", 14, h - 7);
    doc.text(`Página ${i} de ${total}`, w - 14, h - 7, { align: "right" });
  }
}

export function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...ORANGE);
  doc.rect(14, y - 4.2, 2.6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GRAPHITE);
  doc.text(title.toUpperCase(), 20, y);
  return y + 5;
}

export function drawOverview(doc: jsPDF, snapshot: KanbanSnapshot, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const items: { label: string; value: number; accent?: boolean }[] = [
    { label: "Total", value: snapshot.overview.total },
    { label: "Entregues", value: snapshot.overview.delivered },
    { label: "Em andamento", value: snapshot.overview.inProgress },
    { label: "Atrasadas", value: snapshot.overview.overdue, accent: true },
    { label: "Vencem em 7 dias", value: snapshot.overview.dueSoon },
    { label: "Responsáveis", value: snapshot.overview.people },
  ];

  const usable = w - 28;
  const gap = 4;
  const cardW = (usable - gap * (items.length - 1)) / items.length;
  const cardH = 20;

  items.forEach((item, i) => {
    const x = 14 + i * (cardW + gap);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    if (item.accent && item.value > 0) doc.setTextColor(...DANGER);
    else doc.setTextColor(...GRAPHITE);
    doc.text(String(item.value), x + cardW / 2, y + 10, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(item.label, x + cardW / 2, y + 15.5, { align: "center" });
  });

  return y + cardH + 10;
}

function lastY(doc: jsPDF, fallback: number): number {
  const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return typeof y === "number" ? y : fallback;
}

export interface SnapshotPdfMeta {
  title: string;
  subtitle: string;
  generatedAt: Date;
  scopeLabel: string;
  authorName: string;
}

/** Renders the full set of snapshot blocks (panorama, stages, people, details). */
export function renderSnapshotSections(
  doc: jsPDF,
  snapshot: KanbanSnapshot,
  startY: number,
  meta: SnapshotPdfMeta
): number {
  const w = doc.internal.pageSize.getWidth();

  let y = startY;
  y = sectionTitle(doc, "Panorama", y);
  y = drawOverview(doc, snapshot, y);

  // Por etapa
  y = sectionTitle(doc, "Por etapa", y);
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "Demandas", "Participação", "Atrasadas"]],
    body: snapshot.stages.map((s) => [s.label, String(s.count), `${s.share}%`, String(s.overdue)]),
    theme: "grid",
    headStyles: { fillColor: GRAPHITE, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: GRAPHITE, lineColor: LINE },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 32, halign: "center" },
      3: { cellWidth: 28, halign: "center" },
    },
    margin: { left: 14, right: 14, top: 44 },
    didDrawPage: () => drawHeader(doc, meta),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const stage = snapshot.stages[data.row.index];
        data.cell.styles.textColor = hexToRgb(stage?.color);
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = lastY(doc, y) + 10;

  // Por responsável
  if (y > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    drawHeader(doc, meta);
    y = 44;
  }
  y = sectionTitle(doc, "Por responsável", y);
  autoTable(doc, {
    startY: y,
    head: [["Responsável", "Total", "Entregues", "Atrasadas", "Vencem em 7 dias"]],
    body: snapshot.people.map((p) => [
      p.name,
      String(p.total),
      String(p.delivered),
      String(p.overdue),
      String(p.dueSoon),
    ]),
    theme: "striped",
    headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: GRAPHITE, lineColor: LINE },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 36, halign: "center" },
    },
    margin: { left: 14, right: 14, top: 44 },
    didDrawPage: () => drawHeader(doc, meta),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3 && data.cell.text[0] !== "0") {
        data.cell.styles.textColor = DANGER;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = lastY(doc, y) + 10;

  // Detalhamento por etapa
  snapshot.stages
    .filter((s) => s.count > 0)
    .forEach((stage) => {
      if (y > doc.internal.pageSize.getHeight() - 45) {
        doc.addPage();
        drawHeader(doc, meta);
        y = 44;
      }

      const [r, g, b] = hexToRgb(stage.color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(14, y - 4, w - 28, 7.5, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(stage.label.toUpperCase(), 18, y + 1);
      doc.text(
        `${stage.count} demanda${stage.count === 1 ? "" : "s"}${stage.overdue ? ` · ${stage.overdue} atrasada(s)` : ""}`,
        w - 18,
        y + 1,
        { align: "right" }
      );
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["Código", "Demanda", "Responsável", "Seguidores", "Prioridade", "Serviço", "Prazo"]],
        body: stage.rows.map((row) => [
          row.code || "—",
          row.isSubdemand ? `> ${row.title}` : row.title,
          row.responsible,
          row.followers.length ? row.followers.join(", ") : "—",
          row.priority,
          row.service,
          row.isOverdue
            ? `${formatSnapshotDate(row.dueDate)} (${row.daysLate}d)`
            : formatSnapshotDate(row.dueDate),
        ]),
        theme: "grid",
        headStyles: { fillColor: [245, 245, 245], textColor: GRAPHITE, fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 1.8, textColor: GRAPHITE, lineColor: LINE, overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: 78 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 22, halign: "center" },
          5: { cellWidth: 40 },
          6: { cellWidth: 30, halign: "center" },
        },
        margin: { left: 14, right: 14, top: 44 },
    didDrawPage: () => drawHeader(doc, meta),
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const row = stage.rows[data.row.index];
          if (!row) return;
          if (data.column.index === 6 && row.isOverdue) {
            data.cell.styles.textColor = DANGER;
            data.cell.styles.fontStyle = "bold";
          }
          if (data.column.index === 4) {
            // Yellow needs dark text to stay readable on paper.
            data.cell.styles.textColor = row.priority === "Média" ? GRAPHITE : [255, 255, 255];
            data.cell.styles.fillColor = PRIORITY_FILL[row.priority] || MUTED;
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = lastY(doc, y) + 9;
    });

  return y;
}

export function generateKanbanSnapshotPDF(snapshot: KanbanSnapshot): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const meta: SnapshotPdfMeta = {
    title: "Resumo do Kanban",
    subtitle: snapshot.boardName,
    generatedAt: snapshot.generatedAt,
    scopeLabel: snapshot.scopeLabel,
    authorName: snapshot.authorName,
  };
  drawHeader(doc, meta);
  renderSnapshotSections(doc, snapshot, 44, meta);
  drawFooter(doc);

  const slug = snapshot.boardName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const stamp = snapshot.generatedAt.toISOString().substring(0, 10);
  doc.save(`resumo-kanban-${slug || "quadro"}-${stamp}.pdf`);
}
