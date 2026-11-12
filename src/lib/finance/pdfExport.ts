import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** Parses the semicolon CSV produced by finance exports (quoted cells, "" escapes). */
export function parseFinanceCsv(csv: string): string[][] {
  const text = csv.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}

/** Renders finance CSV content as a landscape PDF table and downloads it. Blank CSV rows split sections. */
export function downloadFinancePdf(csv: string, title: string, filename: string) {
  const rows = parseFinanceCsv(csv);
  const blocks: string[][][] = [[]];
  for (const r of rows) {
    if (r.length === 1 && r[0] === "") { if (blocks[blocks.length - 1].length) blocks.push([]); }
    else blocks[blocks.length - 1].push(r);
  }
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text(title, 40, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
  doc.text(`SoMA+ · gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 56);
  let y = 70;
  for (const b of blocks.filter((x) => x.length)) {
    const multiCol = b[0].length > 2;
    autoTable(doc, {
      startY: y,
      head: multiCol ? [b[0]] : undefined,
      body: multiCol ? b.slice(1) : b,
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [29, 29, 29], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 247, 247] },
      margin: { left: 40, right: 40 },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 16;
  }
  doc.save(filename);
}
