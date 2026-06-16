import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, Eye, Trash2, Share2, Copy, Download, ExternalLink, MoreHorizontal 
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BoardSummaryHistoryItem, useBoardSummaryHistory } from "@/hooks/useBoardSummaryHistory";
import jsPDF from "jspdf";

interface SummaryHistoryDrawerProps {
  boardId: string | undefined;
  onSelectSummary: (summary: BoardSummaryHistoryItem) => void;
}

export function SummaryHistoryDrawer({ boardId, onSelectSummary }: SummaryHistoryDrawerProps) {
  const { history, isLoading, deleteSummary, createShareToken } = useBoardSummaryHistory(boardId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [summaryToDelete, setSummaryToDelete] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelectSummary = (summary: BoardSummaryHistoryItem) => {
    onSelectSummary(summary);
    setSheetOpen(false);
  };
  const handleCopy = async (summary: BoardSummaryHistoryItem) => {
    try {
      await navigator.clipboard.writeText(summary.summary_text);
      toast.success("Análise copiada para a área de transferência");
    } catch {
      toast.error("Erro ao copiar análise");
    }
  };

  const handleExportPDF = (summary: BoardSummaryHistoryItem) => {
    const doc = new jsPDF();
    const boardName = summary.analytics_data.board.name || "Quadro";
    const createdAt = format(new Date(summary.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    doc.setFontSize(18);
    doc.text(`Análise Inteligente - ${boardName}`, 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${createdAt}`, 20, 30);
    
    doc.setTextColor(0);
    doc.setFontSize(12);
    
    const splitText = doc.splitTextToSize(summary.summary_text, 170);
    doc.text(splitText, 20, 45);
    
    doc.save(`analise-${boardName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(summary.created_at), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exportado com sucesso");
  };

  const handleShare = async (summary: BoardSummaryHistoryItem) => {
    const result = await createShareToken.mutateAsync(summary.id);
    if (result) {
      const shareUrl = `${window.location.origin}/shared/summary/${result.token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado para a área de transferência");
    }
  };

  const handleDelete = (id: string) => {
    setSummaryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (summaryToDelete) {
      await deleteSummary.mutateAsync(summaryToDelete);
      setSummaryToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            {history.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {history.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Análises
            </SheetTitle>
            <SheetDescription>
              Análises geradas anteriormente para este quadro
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-10rem)] mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-lg border bg-muted/20 animate-pulse">
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma análise no histórico</p>
                <p className="text-sm text-muted-foreground/70">
                  Gere uma nova análise para vê-la aqui
                </p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer" 
                        onClick={() => handleSelectSummary(item)}
                      >
                        <p className="font-medium text-sm truncate">
                          {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.analytics_data.demands.total} demandas · {item.analytics_data.demands.delivered} entregues
                        </p>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSelectSummary(item)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopy(item)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar texto
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportPDF(item)}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(item)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Compartilhar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(item.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A análise será permanentemente removida do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
