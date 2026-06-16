import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface DemandExport {
  title: string;
  status: string;
  created_at: string;
  priority?: string;
}

interface ExportReportButtonProps {
  demands: DemandExport[];
  teamName?: string;
  periodLabel: string;
  stats: {
    total: number;
    delivered: number;
    inProgress: number;
    pending: number;
  };
}

export function ExportReportButton({ 
  demands, 
  teamName, 
  periodLabel,
  stats 
}: ExportReportButtonProps) {
  
  const exportToCSV = () => {
    try {
      const headers = ["Título", "Status", "Data de Criação", "Prioridade"];
      const rows = demands.map(d => [
        d.title,
        d.status,
        format(new Date(d.created_at), "dd/MM/yyyy"),
        d.priority || "Média"
      ]);

      const csvContent = [
        `Relatório de Demandas - ${teamName || "Equipe"}`,
        `Período: ${periodLabel}`,
        `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        "",
        `Total: ${stats.total} | Entregues: ${stats.delivered} | Em Andamento: ${stats.inProgress} | A Iniciar: ${stats.pending}`,
        "",
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-demandas-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success("Relatório CSV exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar CSV");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(40);
      doc.text("Relatório de Demandas", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(teamName || "Equipe", pageWidth / 2, 28, { align: "center" });
      doc.text(`Período: ${periodLabel}`, pageWidth / 2, 35, { align: "center" });
      
      // Stats summary
      doc.setFontSize(10);
      doc.setTextColor(60);
      const statsText = `Total: ${stats.total} | Entregues: ${stats.delivered} | Em Andamento: ${stats.inProgress} | A Iniciar: ${stats.pending}`;
      doc.text(statsText, pageWidth / 2, 45, { align: "center" });

      // Table
      const tableData = demands.map(d => [
        d.title.length > 40 ? d.title.substring(0, 40) + "..." : d.title,
        d.status,
        format(new Date(d.created_at), "dd/MM/yyyy"),
        d.priority || "Média"
      ]);

      autoTable(doc, {
        startY: 55,
        head: [["Título", "Status", "Data", "Prioridade"]],
        body: tableData,
        theme: "striped",
        headStyles: { 
          fillColor: [242, 135, 5],
          textColor: 255,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 }
        }
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(`relatorio-demandas-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar PDF");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
