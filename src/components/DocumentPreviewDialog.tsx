import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Loader2 } from "lucide-react";
import { downloadFileFromUrl, copyImageToClipboard } from "@/lib/fileDownloadUtils";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileType: string;
  fileSize?: number;
  getUrl: () => Promise<string | null>;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function isPreviewable(fileType: string) {
  return (
    fileType === "application/pdf" ||
    fileType.startsWith("image/") ||
    fileType === "text/plain"
  );
}

export { isPreviewable };

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  fileName,
  fileType,
  fileSize,
  getUrl,
}: DocumentPreviewDialogProps) {
  const getUrlRef = useRef(getUrl);
  getUrlRef.current = getUrl;

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!open) {
      setFileUrl(null);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    setLoading(true);
    setFileUrl(null);
    setBlobUrl(null);

    getUrlRef.current()
      .then(async (url) => {
        if (!alive || !url) {
          if (alive) setFileUrl(null);
          return;
        }
        setFileUrl(url);

        // For PDFs and text, fetch as blob to avoid cross-origin iframe blocking
        const needsBlob = fileType === "application/pdf" || fileType === "text/plain";
        if (needsBlob) {
          try {
            const res = await fetch(url);
            if (!alive) return;
            const blob = await res.blob();
            if (!alive) return;
            const localUrl = URL.createObjectURL(blob);
            setBlobUrl(localUrl);
          } catch (e) {
            console.error("Failed to create blob URL for preview:", e);
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load preview URL:", error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, fileType]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleDownload = async () => {
    const url = fileUrl || (await getUrlRef.current());
    if (!url) return;
    setDownloading(true);
    try {
      await downloadFileFromUrl(url, fileName);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!fileUrl) return;
    setCopying(true);
    try {
      await copyImageToClipboard(fileUrl);
    } finally {
      setCopying(false);
    }
  };

  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf";
  const isText = fileType === "text/plain";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-12">
            <span className="text-sm font-medium truncate">{fileName}</span>
            {fileSize != null && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatFileSize(fileSize)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isImage && (
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!fileUrl || copying}>
                {copying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                Copiar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!fileUrl || downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Baixar
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/10">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Carregando documento...</span>
            </div>
          ) : !fileUrl ? (
            <span className="text-sm text-muted-foreground">Não foi possível carregar o arquivo.</span>
          ) : isPdf ? (
            <iframe src={blobUrl || fileUrl} title={fileName} className="w-full h-full border-0" />
          ) : isImage ? (
            <img src={fileUrl} alt={fileName} className="max-w-full max-h-full object-contain p-4" />
          ) : isText ? (
            <iframe src={blobUrl || fileUrl} title={fileName} className="w-full h-full border-0 bg-background p-4" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
