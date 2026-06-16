import { useState, useEffect } from "react";
import { useCommentAttachments, getRequestAttachmentUrl } from "@/hooks/useRequestAttachments";
import { FileText, Image as ImageIcon, File, Download, Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadFileFromUrl } from "@/lib/fileDownloadUtils";
import { DocumentPreviewDialog, isPreviewable } from "@/components/DocumentPreviewDialog";

interface CommentAttachmentsProps {
  commentId: string;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType.includes("pdf") || fileType.includes("document")) return FileText;
  return File;
}

export function CommentAttachments({ commentId, className }: CommentAttachmentsProps) {
  const { data: attachments, isLoading } = useCommentAttachments(commentId);
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [loadingUrls, setLoadingUrls] = useState<Record<string, string>>({});
  const [previewFile, setPreviewFile] = useState<{ filePath: string; fileName: string; fileType: string; fileSize: number } | null>(null);

  const loadImageUrl = async (filePath: string, attachmentId: string) => {
    if (loadingUrls[attachmentId]) return loadingUrls[attachmentId];
    const url = await getRequestAttachmentUrl(filePath);
    if (url) {
      setLoadingUrls((prev) => ({ ...prev, [attachmentId]: url }));
    }
    return url;
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getRequestAttachmentUrl(filePath);
    if (url) {
      downloadFileFromUrl(url, fileName);
    }
  };

  const handleImageClick = async (filePath: string, attachmentId: string, fileName: string) => {
    const url = loadingUrls[attachmentId] || (await loadImageUrl(filePath, attachmentId));
    if (url) {
      setImagePreview({ url, name: fileName });
    }
  };

  if (isLoading || !attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => a.file_type.startsWith("image/"));
  const files = attachments.filter((a) => !a.file_type.startsWith("image/"));

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((attachment) => (
            <ImageThumbnail
              key={attachment.id}
              attachment={attachment}
              onClick={() => handleImageClick(attachment.file_path, attachment.id, attachment.file_name)}
              cachedUrl={loadingUrls[attachment.id]}
              onLoadUrl={(url) => setLoadingUrls((prev) => ({ ...prev, [attachment.id]: url }))}
            />
          ))}
        </div>
      )}

      {/* Other files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((attachment) => {
            const Icon = getFileIcon(attachment.file_type);
            const canPreview = isPreviewable(attachment.file_type);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-2 bg-background border rounded-md px-2 py-1 text-xs"
              >
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[100px]">{attachment.file_name}</span>
                <span className="text-muted-foreground">{formatSize(attachment.file_size)}</span>
                {canPreview && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setPreviewFile({ filePath: attachment.file_path, fileName: attachment.file_name, fileType: attachment.file_type, fileSize: attachment.file_size })}
                    title="Visualizar"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => handleDownload(attachment.file_path, attachment.file_name)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Image preview modal */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-4 flex flex-col items-center justify-center gap-3">
          {imagePreview && (
            <>
              <img
                src={imagePreview.url}
                alt={imagePreview.name}
                className="max-w-full max-h-[78vh] object-contain rounded-md"
              />
              <div className="flex items-center justify-between w-full px-1">
                <span className="text-sm text-muted-foreground truncate max-w-[70%]">
                  {imagePreview.name}
                </span>
                <Button variant="outline" size="sm" onClick={() => downloadFileFromUrl(imagePreview.url, imagePreview.name)}>
                  <Download className="h-4 w-4 mr-1" />
                  Baixar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Document preview modal */}
      {previewFile && (
        <DocumentPreviewDialog
          open={!!previewFile}
          onOpenChange={(open) => { if (!open) setPreviewFile(null); }}
          fileName={previewFile.fileName}
          fileType={previewFile.fileType}
          fileSize={previewFile.fileSize}
          getUrl={() => getRequestAttachmentUrl(previewFile.filePath)}
        />
      )}
    </div>
  );
}

interface ImageThumbnailProps {
  attachment: { id: string; file_path: string; file_name: string };
  onClick: () => void;
  cachedUrl?: string;
  onLoadUrl: (url: string) => void;
}

function ImageThumbnail({ attachment, onClick, cachedUrl, onLoadUrl }: ImageThumbnailProps) {
  const [url, setUrl] = useState<string | null>(cachedUrl || null);
  const [loading, setLoading] = useState(!cachedUrl);
  const [exists, setExists] = useState(true);

  useEffect(() => {
    if (!cachedUrl) {
      getRequestAttachmentUrl(attachment.file_path).then((loadedUrl) => {
        if (loadedUrl) {
          setUrl(loadedUrl);
          onLoadUrl(loadedUrl);
        } else {
          setExists(false);
        }
        setLoading(false);
      });
    }
  }, [attachment.file_path, cachedUrl]);

  // Hide if file doesn't exist
  if (!loading && !exists) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-12 h-12 rounded-md overflow-hidden border bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary transition-all"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      ) : url ? (
        <img src={url} alt={attachment.file_name} className="w-full h-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
