import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAttachmentUrl } from "@/hooks/useAttachments";
import { FileText, Download, Eye, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadFileFromUrl, copyImageToClipboard } from "@/lib/fileDownloadUtils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentPreviewDialog, isPreviewable } from "@/components/DocumentPreviewDialog";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  resolved_url?: string;
}

type ExistingAttachment = Attachment & {
  resolved_url: string;
};

interface InteractionAttachmentsProps {
  interactionId: string;
  className?: string;
}

export function useInteractionAttachments(interactionId: string | null) {
  return useQuery({
    queryKey: ["interaction-attachments", interactionId, "existing-only"],
    queryFn: async () => {
      if (!interactionId) return [];
      const { data, error } = await supabase
        .from("demand_attachments")
        .select("id, file_name, file_path, file_type, file_size")
        .eq("interaction_id", interactionId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const attachments = (data as Attachment[]) ?? [];
      const validatedAttachments = await Promise.all<ExistingAttachment | null>(
        attachments.map(async (attachment) => {
          const resolvedUrl = await getAttachmentUrl(attachment.file_path);
          if (!resolvedUrl) return null;

          return {
            ...attachment,
            resolved_url: resolvedUrl,
          };
        })
      );

      return validatedAttachments.filter((attachment): attachment is ExistingAttachment => attachment !== null);
    },
    enabled: !!interactionId,
  });
}

function AttachmentItem({ attachment }: { attachment: Attachment }) {
  const [imageUrl, setImageUrl] = useState<string | null>(attachment.resolved_url ?? null);
  const [isLoading, setIsLoading] = useState(!attachment.resolved_url);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileExists, setFileExists] = useState(!!attachment.resolved_url);
  const [copying, setCopying] = useState(false);
  
  const isImage = attachment.file_type.startsWith("image/");
  const canPreview = isPreviewable(attachment.file_type);
  
  useEffect(() => {
    let isMounted = true;

    if (attachment.resolved_url) {
      if (isImage) {
        setImageUrl(attachment.resolved_url);
      }
      setFileExists(true);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    getAttachmentUrl(attachment.file_path).then((url) => {
      if (!isMounted) return;

      if (isImage) {
        setImageUrl(url);
      }
      setFileExists(!!url);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isImage, attachment.file_path, attachment.resolved_url]);

  // Hide attachment if file doesn't exist in storage
  if (!isLoading && !fileExists) {
    return null;
  }

  const handleDownload = async () => {
    const url = attachment.resolved_url || imageUrl || await getAttachmentUrl(attachment.file_path);
    if (url) {
      downloadFileFromUrl(url, attachment.file_name);
    } else {
      toast.error("Arquivo não disponível");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div 
        className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {isImage ? (
          isLoading ? (
            <div className="h-10 w-10 rounded bg-muted animate-pulse flex-shrink-0" />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={attachment.file_name}
              className="h-10 w-10 object-cover rounded flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          )
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isImage && imageUrl && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(true)} title="Visualizar">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          {canPreview && !isImage && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewOpen(true)} title="Visualizar">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isImage && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-4 flex flex-col items-center justify-center gap-3">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={attachment.file_name}
                className="max-w-full max-h-[78vh] object-contain rounded-md"
              />
            )}
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-sm text-muted-foreground truncate max-w-[70%]">
                {attachment.file_name}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!imageUrl || copying} onClick={async () => {
                  if (!imageUrl) return;
                  setCopying(true);
                  try { await copyImageToClipboard(imageUrl); } finally { setCopying(false); }
                }}>
                  {copying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={() => imageUrl && downloadFileFromUrl(imageUrl, attachment.file_name)}>
                  <Download className="h-4 w-4 mr-1" />
                  Baixar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {canPreview && !isImage && (
        <DocumentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fileName={attachment.file_name}
          fileType={attachment.file_type}
          fileSize={attachment.file_size}
          getUrl={() => Promise.resolve(attachment.resolved_url).then((url) => url || getAttachmentUrl(attachment.file_path))}
        />
      )}
    </>
  );
}

const COLLAPSED_COUNT = 3;

export function InteractionAttachments({ interactionId, className }: InteractionAttachmentsProps) {
  const { data: attachments, isLoading } = useInteractionAttachments(interactionId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !attachments || attachments.length === 0) {
    return null;
  }

  const hasMore = attachments.length > COLLAPSED_COUNT;
  const visibleAttachments = expanded ? attachments : attachments.slice(0, COLLAPSED_COUNT);
  const hiddenCount = attachments.length - COLLAPSED_COUNT;

  return (
    <div className={cn("mt-2", className)}>
      <div className="space-y-1">
        {visibleAttachments.map((attachment) => (
          <AttachmentItem key={attachment.id} attachment={attachment} />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          {expanded ? "Mostrar menos" : `Ver mais ${hiddenCount} anexo(s)`}
        </button>
      )}
    </div>
  );
}
