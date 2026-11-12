import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawFooter, drawHeader, sectionTitle } from "@/lib/kanbanSnapshotPdf";
import { formatBRL, formatPct } from "@/lib/finance/engine";

const ORANGE: [number, number, number] = [242, 135, 5];
const GRAPHITE: [number, number, number] = [29, 29, 29];
const LINE: [number, number, number] = [228, 228, 228];
const MUTED: [number, number, number] = [120, 120, 120];
const DANGER: [number, number, number] = [220, 38, 38];

export interface ProfitTotals { gross: number; tax: number; netRevenue: number; totalCost: number; result: number; margin: number | null; target: number }
export interface ProfitMonth { month: string; gross: number; cost: number; result: number }
export interface ProfitBoard extends ProfitTotals { name: string; hoursRealized: number; teamCost: number; directExpenses: number; allocated: number; deviationPp: number | null; status: string; statusLabel: string }

const lastY = (doc: jsPDF, f: number) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? f;

export function generateProfitabilityPdf(input: {
  teamName: string; periodLabel: string; scopeLabel: string; authorName: string;
  total: ProfitTotals; months: ProfitMonth[]; boards: ProfitBoard[]; filename: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const meta = { title: "Inteligência Financeira", subtitle: `${input.teamName} · Rentabilidade ${input.periodLabel}`, generatedAt: new Date(), scopeLabel: input.scopeLabel, authorName: input.authorName };
  drawHeader(doc, meta);
  let y = 44;

  // Ledger strip — same reading as the overview screen.
  y = sectionTitle(doc, "Visão geral", y);
  const t = input.total;
  const tiles = [
    ["FATURAMENTO BRUTO", formatBRL(t.gross)], ["- IMPOSTOS", formatBRL(t.tax)], ["= RECEITA LÍQUIDA", formatBRL(t.netRevenue)],
    ["- CUSTO TOTAL", formatBRL(t.totalCost)], ["= RESULTADO", formatBRL(t.result)], ["MARGEM", formatPct(t.margin)],
  ];
  const stripH = 34, x0 = 14, sw = w - 28, cw = sw / tiles.length;
  doc.setFillColor(...GRAPHITE); doc.roundedRect(x0, y, sw, stripH, 2.5, 2.5, "F");
  tiles.forEach(([l, v], i) => {
    const x = x0 + i * cw + 5;
    if (i) { doc.setDrawColor(70, 70, 70); doc.line(x0 + i * cw, y + 4, x0 + i * cw, y + 20); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(170, 170, 170); doc.text(l, x, y + 8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    const neg = (i === 4 && t.result < 0);
    if (neg) doc.setTextColor(248, 113, 113); else doc.setTextColor(255, 255, 255);
    doc.text(v, x, y + 16);
  });
  // Margin ruler
  const rx = x0 + 5, rw = sw - 10, ry = y + 25;
  doc.setFillColor(70, 70, 70); doc.roundedRect(rx, ry, rw, 2.2, 1, 1, "F");
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  if (t.margin !== null) { doc.setFillColor(...(t.margin < 0 ? DANGER : t.margin >= t.target ? [255, 255, 255] as [number, number, number] : ORANGE)); doc.roundedRect(rx, ry, Math.max(1, rw * clamp(t.margin)), 2.2, 1, 1, "F"); }
  doc.setFillColor(...ORANGE); doc.rect(rx + rw * clamp(t.target) - 0.5, ry - 1.5, 1, 5.2, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(190, 190, 190);
  doc.text(`Margem ${formatPct(t.margin)}  ·  Meta ${formatPct(t.target)}`, rx, ry + 6.5);
  y += stripH + 10;

  // Monthly evolution: bars + table
  if (input.months.length) {
    y = sectionTitle(doc, "Evolução mensal", y);
    const chH = 42, chX = 30, chW = w - 14 - chX, base = y + chH;
    const max = Math.max(1, ...input.months.flatMap((m) => [m.gross, m.cost, Math.abs(m.result)]));
    doc.setDrawColor(...LINE); doc.line(chX, base, chX + chW, base);
    doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(formatBRL(max), chX - 2, y + 2, { align: "right" }); doc.text("0", chX - 2, base, { align: "right" });
    const gw = chW / input.months.length, bw = Math.min(8, (gw - 6) / 3);
    input.months.forEach((m, i) => {
      const gx = chX + i * gw + (gw - bw * 3 - 2) / 2;
      ([[m.gross, GRAPHITE], [m.cost, [190, 190, 190]], [m.result, m.result < 0 ? DANGER : ORANGE]] as [number, [number, number, number]][]).forEach(([v, c], j) => {
        const bh = (Math.abs(v) / max) * (chH - 4);
        doc.setFillColor(...c); doc.rect(gx + j * (bw + 1), base - bh, bw, bh, "F");
      });
      doc.setTextColor(...MUTED); doc.text(m.month, chX + i * gw + gw / 2, base + 4, { align: "center" });
    });
    // legend
    let lx = chX; const ly = base + 9;
    ([["Faturamento", GRAPHITE], ["Custos + impostos", [190, 190, 190]], ["Resultado", ORANGE]] as [string, [number, number, number]][]).forEach(([l, c]) => {
      doc.setFillColor(...c); doc.rect(lx, ly - 2.2, 3, 3, "F"); doc.setTextColor(...GRAPHITE); doc.text(l, lx + 4.5, ly); lx += doc.getTextWidth(l) + 12;
    });
    y = ly + 8;
  }

  // Per-board table
  if (y > h - 50) { doc.addPage(); drawHeader(doc, meta); y = 44; }
  y = sectionTitle(doc, "Rentabilidade por quadro", y);
  autoTable(doc, {
    startY: y,
    head: [["Quadro", "Faturamento", "Impostos", "Receita líq.", "Horas", "Custo equipe", "Desp. diretas", "Rateio", "Custo total", "Resultado", "Margem", "Meta", "Status"]],
    body: input.boards.map((b) => [b.name, formatBRL(b.gross), formatBRL(b.tax), formatBRL(b.netRevenue), `${b.hoursRealized.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`,
      formatBRL(b.teamCost), formatBRL(b.directExpenses), formatBRL(b.allocated), formatBRL(b.totalCost), formatBRL(b.result), formatPct(b.margin), formatPct(b.target), b.statusLabel]),
    foot: [["Total", formatBRL(t.gross), formatBRL(t.tax), formatBRL(t.netRevenue), "", "", "", "", formatBRL(t.totalCost), formatBRL(t.result), formatPct(t.margin), formatPct(t.target), ""]],
    theme: "grid",
    headStyles: { fillColor: GRAPHITE, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: [245, 245, 245], textColor: GRAPHITE, fontStyle: "bold", fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: GRAPHITE, lineColor: LINE },
    columnStyles: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 1, { halign: "right" }]).concat([[0, { cellWidth: 38 }], [12, { halign: "center" }]] as never)),
    margin: { left: 14, right: 14, top: 44 },
    didDrawPage: () => drawHeader(doc, meta),
    didParseCell: (d) => {
      if (d.section === "foot" && d.column.index > 0) d.cell.styles.halign = "right";
      if (d.section !== "body") return;
      const b = input.boards[d.row.index];
      if (d.column.index === 9 && b.result < 0) { d.cell.styles.textColor = DANGER; d.cell.styles.fontStyle = "bold"; }
      if (d.column.index === 12) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = b.status === "prejuizo" ? DANGER : b.status === "atencao" ? ORANGE : b.status === "sem_dados" ? MUTED : GRAPHITE;
      }
    },
  });
  y = lastY(doc, y) + 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("Custo total = custo das horas apontadas + despesas diretas + rateio. Margem = resultado ÷ faturamento bruto. Custo de equipe sempre agregado por quadro.", 14, Math.min(y, h - 14));

  drawFooter(doc);
  doc.save(input.filename);
}
