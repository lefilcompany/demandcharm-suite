import * as React from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ExportFormat = "pdf" | "csv";

/**
 * Botão único de exportação: abre a escolha entre PDF e CSV.
 * Substitui os dois botões soltos (CSV / PDF) que poluíam o cabeçalho das telas.
 */
export function ExportReportButton({
  onExport,
  disabled,
  className,
  size = "sm",
  label = "Exportar Relatório",
}: {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className={cn("gap-1.5", className)} disabled={disabled}>
          <Download className="h-4 w-4" />
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onSelect={() => onExport("pdf")}>
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport("csv")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
