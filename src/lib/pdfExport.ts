import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Soma+ Brand Colors
const COLORS = {
  primary: { r: 242, g: 135, b: 5 },       // #F28705
  primaryDark: { r: 217, g: 82, b: 4 },    // #D95204
  primaryLight: { r: 242, g: 159, b: 5 },  // #F29F05
  text: { r: 29, g: 29, b: 29 },           // #1D1D1D
  textMuted: { r: 100, g: 100, b: 100 },
  background: { r: 248, g: 248, b: 248 },
  white: { r: 255, g: 255, b: 255 },
  success: { r: 16, g: 185, b: 129 },      // emerald
  warning: { r: 245, g: 158, b: 11 },      // amber
  danger: { r: 239, g: 68, b: 68 },        // red
};

// Draw stylized Soma+ logo using shapes
function drawLogoShapes(doc: jsPDF, x: number, y: number, size: number) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  
  // Background circle with gradient effect (two circles)
  doc.setFillColor(COLORS.primaryDark.r, COLORS.primaryDark.g, COLORS.primaryDark.b);
  doc.circle(centerX, centerY, size / 2, "F");
  doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.circle(centerX - 1, centerY - 1, size / 2 - 1, "F");
  
  // White "S+" text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 0.55);
  doc.setTextColor(255, 255, 255);
  const text = "S+";
  const textWidth = doc.getTextWidth(text);
  doc.text(text, centerX - textWidth / 2, centerY + size * 0.18);
  
  // Reset colors
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
}

export interface BoardAnalytics {
  board: { name: string; description: string | null; monthlyLimit: number | null };
  period: { start: string; end: string; days: number };
  demands: {
    total: number;
    delivered: number;
    onTime: number;
    late: number;
    overdue: number;
    avgDeliveryDays: number;
    avgDaysLate?: number;
    avgDaysOverdue?: number;
    withDueDate?: number;
    withoutDueDate?: number;
    onTimeRate?: number;
    byStatus: { status: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  };
  members: {
    name: string;
    role: string;
    demandCount: number;
    completedCount: number;
    onTimeCount?: number;
    lateCount?: number;
    completionRate: number;
    onTimeRate?: number;
    avgTimeHours: number;
  }[];
  requesters: {
    name: string;
    requestCount: number;
    pending: number;
    approved: number;
    rejected: number;
    avgPerWeek: number;
  }[];
  timeTracking: {
    totalHours: number;
    byExecutor: { name: string; hours: number; demandCount: number }[];
    avgHoursPerDemand: number;
  };
}

interface PDFGeneratorParams {
  boardName: string;
  createdAt: Date;
  summaryText: string;
  analytics: BoardAnalytics;
}

interface PDFContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  currentY: number;
}

function addHeader(ctx: PDFContext, boardName: string, createdAt: Date): void {
  const { doc, margin, pageWidth } = ctx;
  
  // Header background
  doc.setFillColor(COLORS.background.r, COLORS.background.g, COLORS.background.b);
  doc.rect(0, 0, pageWidth, 45, "F");
  
  // Orange accent line at top
  doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.rect(0, 0, pageWidth, 3, "F");
  
  // Logo (using shapes)
  drawLogoShapes(doc, margin, 8, 28);
  
  // Brand name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.text("Soma+", margin + 35, 22);
  
  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
  doc.text("Gestão Inteligente de Demandas", margin + 35, 30);
  
  // Title and date on the right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
  const title = "Análise Inteligente";
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, pageWidth - margin - titleWidth, 18);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
  const boardText = `Quadro: ${boardName}`;
  const boardWidth = doc.getTextWidth(boardText);
  doc.text(boardText, pageWidth - margin - boardWidth, 28);
  
  const dateText = format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, pageWidth - margin - dateWidth, 38);
  
  // Orange line separator
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.line(margin, 48, pageWidth - margin, 48);
  
  ctx.currentY = 55;
}

function addFooter(ctx: PDFContext, pageNumber: number, totalPages: number): void {
  const { doc, margin, pageWidth, pageHeight } = ctx;
  
  // Footer line
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  
  // Copyright text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
  
  const year = new Date().getFullYear();
  const copyrightLine1 = `© ${year} Soma+ · Gestão Inteligente de Demandas · Todos os direitos reservados`;
  const copyrightLine2 = "Este documento foi gerado automaticamente. A reprodução ou distribuição não autorizada é proibida.";
  
  doc.text(copyrightLine1, margin, pageHeight - 14);
  doc.text(copyrightLine2, margin, pageHeight - 10);
  
  // Page number on the right
  const pageText = `Página ${pageNumber} de ${totalPages}`;
  const pageTextWidth = doc.getTextWidth(pageText);
  doc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 12);
}

function addQuickStats(ctx: PDFContext, analytics: BoardAnalytics): void {
  const { doc, margin, contentWidth } = ctx;
  
  const onTimeRate = analytics.demands.onTimeRate !== undefined
    ? analytics.demands.onTimeRate
    : analytics.demands.onTime + analytics.demands.late > 0
      ? Math.round((analytics.demands.onTime / (analytics.demands.onTime + analytics.demands.late)) * 100)
      : 0;
  
  const stats = [
    { 
      value: String(analytics.demands.total), 
      label: "Total", 
      subLabel: `${analytics.demands.delivered} entregues`,
      color: COLORS.primary 
    },
    { 
      value: `${onTimeRate}%`, 
      label: "No Prazo", 
      subLabel: `${analytics.demands.onTime} demandas`,
      color: onTimeRate >= 80 ? COLORS.success : onTimeRate >= 60 ? COLORS.warning : COLORS.danger
    },
    { 
      value: String(analytics.demands.overdue), 
      label: "Vencidas", 
      subLabel: "prazo expirado",
      color: analytics.demands.overdue === 0 ? COLORS.success : analytics.demands.overdue <= 3 ? COLORS.warning : COLORS.danger
    },
    { 
      value: `${analytics.demands.avgDeliveryDays}d`, 
      label: "Tempo Médio", 
      subLabel: "por demanda",
      color: COLORS.primary 
    },
  ];
  
  const cardWidth = (contentWidth - 15) / 4;
  const cardHeight = 32;
  
  stats.forEach((stat, index) => {
    const x = margin + (cardWidth + 5) * index;
    const y = ctx.currentY;
    
    // Card background
    doc.setFillColor(COLORS.background.r, COLORS.background.g, COLORS.background.b);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");
    
    // Left accent
    doc.setFillColor(stat.color.r, stat.color.g, stat.color.b);
    doc.rect(x, y + 3, 2, cardHeight - 6, "F");
    
    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
    doc.text(stat.value, x + 8, y + 14);
    
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
    doc.text(stat.label, x + 8, y + 22);
    
    // Sub label
    doc.setFontSize(7);
    doc.text(stat.subLabel, x + 8, y + 28);
  });
  
  ctx.currentY += cardHeight + 12;
}

function addSectionTitle(ctx: PDFContext, title: string): void {
  const { doc, margin, pageHeight } = ctx;
  
  // Check if we need a new page
  if (ctx.currentY > pageHeight - 60) {
    doc.addPage();
    ctx.currentY = 25;
  }
  
  // Orange accent
  doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.rect(margin, ctx.currentY, 3, 12, "F");
  
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
  doc.text(title.toUpperCase(), margin + 8, ctx.currentY + 9);
  
  ctx.currentY += 18;
}

function addMemberTable(ctx: PDFContext, members: BoardAnalytics["members"]): void {
  const { doc, margin, contentWidth } = ctx;
  
  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    moderator: "Moderador",
    executor: "Executor",
    requester: "Solicitante",
  };
  
  const filteredMembers = members.filter(m => m.demandCount > 0);
  
  if (filteredMembers.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
    doc.text("Nenhum membro com demandas atribuídas", margin, ctx.currentY);
    ctx.currentY += 10;
    return;
  }
  
  const tableData = filteredMembers
    .sort((a, b) => b.completionRate - a.completionRate)
    .map(member => [
      member.name,
      roleLabels[member.role] || member.role,
      `${member.completedCount}/${member.demandCount}`,
      `${member.completionRate}%`,
      member.avgTimeHours > 0 ? `${member.avgTimeHours}h` : "—",
    ]);
  
  autoTable(doc, {
    startY: ctx.currentY,
    head: [["Membro", "Cargo", "Demandas", "Taxa", "Tempo Médio"]],
    body: tableData,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [COLORS.text.r, COLORS.text.g, COLORS.text.b],
    },
    headStyles: {
      fillColor: [COLORS.primary.r, COLORS.primary.g, COLORS.primary.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [COLORS.background.r, COLORS.background.g, COLORS.background.b],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 35 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
    },
  });
  
  ctx.currentY = (doc as any).lastAutoTable.finalY + 10;
}

function addTimeTable(ctx: PDFContext, timeTracking: BoardAnalytics["timeTracking"]): void {
  const { doc, margin, contentWidth, pageWidth } = ctx;
  
  // Total hours highlight
  doc.setFillColor(255, 247, 237); // Light orange background
  doc.roundedRect(margin, ctx.currentY, contentWidth, 18, 2, 2, "F");
  
  // Orange border
  doc.setDrawColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, ctx.currentY, contentWidth, 18, 2, 2, "S");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  doc.text(`Total de Horas: ${timeTracking.totalHours}h`, margin + 8, ctx.currentY + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
  const avgText = `Média: ${timeTracking.avgHoursPerDemand}h por demanda`;
  const avgWidth = doc.getTextWidth(avgText);
  doc.text(avgText, pageWidth - margin - avgWidth - 8, ctx.currentY + 12);
  
  ctx.currentY += 25;
  
  if (timeTracking.byExecutor.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Nenhum tempo registrado", margin, ctx.currentY);
    ctx.currentY += 10;
    return;
  }
  
  const tableData = timeTracking.byExecutor
    .sort((a, b) => b.hours - a.hours)
    .map(executor => [
      executor.name,
      `${executor.hours}h`,
      String(executor.demandCount),
    ]);
  
  autoTable(doc, {
    startY: ctx.currentY,
    head: [["Executor", "Horas", "Demandas"]],
    body: tableData,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [COLORS.text.r, COLORS.text.g, COLORS.text.b],
    },
    headStyles: {
      fillColor: [COLORS.primaryDark.r, COLORS.primaryDark.g, COLORS.primaryDark.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [COLORS.background.r, COLORS.background.g, COLORS.background.b],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
    },
  });
  
  ctx.currentY = (doc as any).lastAutoTable.finalY + 10;
}

function parseMarkdownToPDF(ctx: PDFContext, markdown: string): void {
  const { doc, margin, contentWidth, pageHeight } = ctx;
  
  const lines = markdown.split("\n");
  const lineHeight = 5;
  
  for (const line of lines) {
    // Check for page break
    if (ctx.currentY > pageHeight - 35) {
      doc.addPage();
      ctx.currentY = 25;
    }
    
    const trimmedLine = line.trim();
    
    if (trimmedLine === "") {
      ctx.currentY += lineHeight * 0.8;
      continue;
    }
    
    // H2 headers (##)
    if (trimmedLine.startsWith("## ")) {
      const text = trimmedLine.replace(/^##\s*/, "").replace(/\*\*/g, "");
      ctx.currentY += 4;
      
      doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
      doc.rect(margin, ctx.currentY - 3, 2, 10, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
      doc.text(text, margin + 6, ctx.currentY + 4);
      ctx.currentY += 12;
      continue;
    }
    
    // H3 headers (###)
    if (trimmedLine.startsWith("### ")) {
      const text = trimmedLine.replace(/^###\s*/, "").replace(/\*\*/g, "");
      ctx.currentY += 2;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COLORS.primaryDark.r, COLORS.primaryDark.g, COLORS.primaryDark.b);
      doc.text(text, margin, ctx.currentY + 3);
      ctx.currentY += 10;
      continue;
    }
    
    // Bullet points
    if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      const text = trimmedLine.slice(2);
      
      // Handle bold text
      const hasBold = text.includes("**");
      const parts = text.split(/\*\*/);
      
      // Orange bullet
      doc.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
      doc.circle(margin + 3, ctx.currentY + 1, 1.2, "F");
      
      let xOffset = margin + 8;
      doc.setFontSize(9);
      
      parts.forEach((part, i) => {
        const isBold = hasBold && i % 2 === 1;
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(
          isBold ? COLORS.text.r : COLORS.textMuted.r,
          isBold ? COLORS.text.g : COLORS.textMuted.g,
          isBold ? COLORS.text.b : COLORS.textMuted.b
        );
        
        // Wrap long text
        const maxWidth = contentWidth - 10;
        const wrappedLines = doc.splitTextToSize(part, maxWidth - (xOffset - margin));
        
        if (typeof wrappedLines === "string") {
          doc.text(wrappedLines, xOffset, ctx.currentY + 2);
          xOffset += doc.getTextWidth(wrappedLines);
        } else {
          wrappedLines.forEach((wl: string, idx: number) => {
            if (idx === 0) {
              doc.text(wl, xOffset, ctx.currentY + 2);
              xOffset = margin + 8;
            } else {
              ctx.currentY += lineHeight;
              if (ctx.currentY > pageHeight - 35) {
                doc.addPage();
                ctx.currentY = 25;
              }
              doc.text(wl, margin + 8, ctx.currentY + 2);
            }
          });
        }
      });
      
      ctx.currentY += lineHeight + 1;
      continue;
    }
    
    // Regular paragraph
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.textMuted.r, COLORS.textMuted.g, COLORS.textMuted.b);
    
    // Handle inline bold
    const text = trimmedLine;
    const hasBold = text.includes("**");
    
    if (hasBold) {
      const parts = text.split(/\*\*/);
      let xOffset = margin;
      
      parts.forEach((part, i) => {
        const isBold = i % 2 === 1;
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(
          isBold ? COLORS.text.r : COLORS.textMuted.r,
          isBold ? COLORS.text.g : COLORS.textMuted.g,
          isBold ? COLORS.text.b : COLORS.textMuted.b
        );
        doc.text(part, xOffset, ctx.currentY + 2);
        xOffset += doc.getTextWidth(part);
      });
    } else {
      const wrappedLines = doc.splitTextToSize(text, contentWidth);
      if (typeof wrappedLines === "string") {
        doc.text(wrappedLines, margin, ctx.currentY + 2);
      } else {
        wrappedLines.forEach((wl: string, idx: number) => {
          if (idx > 0) {
            ctx.currentY += lineHeight;
            if (ctx.currentY > pageHeight - 35) {
              doc.addPage();
              ctx.currentY = 25;
            }
          }
          doc.text(wl, margin, ctx.currentY + 2);
        });
      }
    }
    
    ctx.currentY += lineHeight + 1;
  }
}

export async function generateBoardSummaryPDF(params: PDFGeneratorParams): Promise<void> {
  const { boardName, createdAt, summaryText, analytics } = params;
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  
  // Set document metadata
  doc.setProperties({
    title: `Análise Inteligente - ${boardName}`,
    subject: "Relatório de Análise de Demandas",
    author: "Soma+ · Gestão Inteligente de Demandas",
    keywords: "soma, demandas, análise, relatório",
    creator: "Soma+",
  });
  
  const ctx: PDFContext = {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: 15,
    contentWidth: doc.internal.pageSize.getWidth() - 30,
    currentY: 0,
  };
  
  // Page 1: Header and Quick Stats
  addHeader(ctx, boardName, createdAt);
  addQuickStats(ctx, analytics);
  
  // AI Summary Section
  addSectionTitle(ctx, "Relatório de Análise");
  parseMarkdownToPDF(ctx, summaryText);
  
  // Team Performance Section
  ctx.currentY += 5;
  addSectionTitle(ctx, "Performance da Equipe");
  addMemberTable(ctx, analytics.members);
  
  // Time Tracking Section
  ctx.currentY += 5;
  addSectionTitle(ctx, "Tempo Investido");
  addTimeTable(ctx, analytics.timeTracking);
  
  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(ctx, i, totalPages);
  }
  
  // Generate filename
  const safeBoardName = boardName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const dateStr = format(createdAt, "yyyy-MM-dd");
  const filename = `analise-${safeBoardName}-${dateStr}.pdf`;
  
  // Save the PDF
  doc.save(filename);
}
