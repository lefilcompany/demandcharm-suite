import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { downloadFileFromUrl, copyImageToClipboard } from "@/lib/fileDownloadUtils";
import { cn } from "@/lib/utils";

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  fileName: string;
}

export function ImagePreviewDialog({ open, onOpenChange, url, fileName }: ImagePreviewDialogProps) {
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!open) setZoomed(false);
  }, [open]);

  const handleCopy = async () => {
    if (!url) return;
    setCopying(true);
    try {
      await copyImageToClipboard(url);
    } finally {
      setCopying(false);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    setDownloading(true);
    try {
      await downloadFileFromUrl(url, fileName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-[96vw] w-[96vw] h-[94vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
          <span className="text-sm font-medium truncate pr-12">{fileName}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setZoomed((z) => !z)} disabled={!url}>
              {zoomed ? <ZoomOut className="h-4 w-4 mr-1" /> : <ZoomIn className="h-4 w-4 mr-1" />}
              {zoomed ? "Ajustar" : "Tamanho real"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!url || copying}>
              {copying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!url || downloading}>
              {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Baixar
            </Button>
          </div>
        </div>

        <div className={cn("flex-1 min-h-0 bg-muted/10", zoomed ? "overflow-auto" : "flex items-center justify-center overflow-hidden")}>
          {url ? (
            <img
              src={url}
              alt={fileName}
              onClick={() => setZoomed((z) => !z)}
              className={cn(
                "rounded-md cursor-zoom-in",
                zoomed ? "max-w-none cursor-zoom-out" : "max-w-full max-h-full object-contain"
              )}
            />
          ) : (
            <span className="text-sm text-muted-foreground">Não foi possível carregar a imagem.</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
