import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ProjectSnapshot } from "@/lib/projectSnapshot";
import {
  SnapshotPdfMeta,
  drawFooter,
  drawHeader,
  drawOverview,
  renderSnapshotSections,
  sectionTitle,
} from "@/lib/kanbanSnapshotPdf";

const ORANGE: [number, number, number] = [242, 135, 5];
const GRAPHITE: [number, number, number] = [29, 29, 29];
const LINE: [number, number, number] = [228, 228, 228];
const DANGER: [number, number, number] = [220, 38, 38];

function lastY(doc: jsPDF, fallback: number): number {
  const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return typeof y === "number" ? y : fallback;
}

export function generateProjectSnapshotPDF(snapshot: ProjectSnapshot): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  const meta: SnapshotPdfMeta = {
    title: "Resumo do Projeto",
    subtitle: snapshot.projectName,
    generatedAt: snapshot.generatedAt,
    scopeLabel: snapshot.scopeLabel,
    authorName: snapshot.authorName,
  };

  drawHeader(doc, meta);
  let y = 44;

  // Consolidated overview across every board in the project.
  y = sectionTitle(doc, "Consolidado do projeto", y);
  y = drawOverview(doc, snapshot.overall, y);

  y = sectionTitle(doc, "Por quadro", y);
  autoTable(doc, {
    startY: y,
    head: [["Quadro", "Demandas", "Entregues", "Atrasadas", "Vencem em 7 dias"]],
    body: snapshot.boards.map((b) => [
      b.boardName,
      String(b.snapshot.overview.total),
      String(b.snapshot.overview.delivered),
      String(b.snapshot.overview.overdue),
      String(b.snapshot.overview.dueSoon),
    ]),
    theme: "grid",
    headStyles: { fillColor: GRAPHITE, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: GRAPHITE, lineColor: LINE },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 28, halign: "center" },
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

  // One full block per board, same layout as the board snapshot.
  snapshot.boards.forEach((board) => {
    doc.addPage();
    drawHeader(doc, { ...meta, subtitle: `${snapshot.projectName} · ${board.boardName}` });
    y = 44;

    doc.setFillColor(...ORANGE);
    doc.roundedRect(14, y - 5, w - 28, 9, 1.8, 1.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`QUADRO: ${board.boardName.toUpperCase()}`, 18, y + 1);
    doc.text(
      `${board.snapshot.overview.total} demanda(s)${
        board.snapshot.overview.overdue ? ` · ${board.snapshot.overview.overdue} atrasada(s)` : ""
      }`,
      w - 18,
      y + 1,
      { align: "right" }
    );
    y += 12;

    y = renderSnapshotSections(doc, board.snapshot, y, {
      ...meta,
      subtitle: `${snapshot.projectName} · ${board.boardName}`,
    });
  });

  drawFooter(doc);

  const slug = snapshot.projectName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const stamp = snapshot.generatedAt.toISOString().substring(0, 10);
  doc.save(`resumo-projeto-${slug || "projeto"}-${stamp}.pdf`);
}
