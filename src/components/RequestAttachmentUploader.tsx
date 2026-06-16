import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Download, FileText, Image, File, Trash2, Loader2, Maximize2, Eye } from "lucide-react";
import { 
  useRequestAttachments, 
  useUploadRequestAttachment, 
  useDeleteRequestAttachment, 
  getRequestAttachmentUrl 
} from "@/hooks/useRequestAttachments";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DocumentPreviewDialog, isPreviewable } from "@/components/DocumentPreviewDialog";

interface RequestAttachmentUploaderProps {
  requestId: string;
  readOnly?: boolean;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface AttachmentItemProps {
  attachment: {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    created_at: string;
  };
  readOnly: boolean;
  onDelete: (id: string, filePath: string) => void;
}

function ImageAttachment({ attachment, readOnly, onDelete, url }: AttachmentItemProps & { url: string }) {
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error("Erro ao baixar arquivo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="relative rounded-lg overflow-hidden border bg-muted/30 group">
        {/* Imagem grande */}
        <div className="relative w-full max-h-80 overflow-hidden">
          <img
            src={url}
            alt={attachment.file_name}
            className="w-full h-auto max-h-80 object-contain bg-background"
          />
          
          {/* Overlay com informações */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="flex items-end justify-between gap-2">
              <div className="text-white min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-white/80">
                  {formatSize(attachment.file_size)} • {format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={() => setPreviewOpen(true)}
                  title="Ampliar imagem"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={handleDownload}
                  disabled={downloading}
                  title="Baixar arquivo"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                
                {!readOnly && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-white/20 hover:bg-destructive/80 text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDelete(attachment.id, attachment.file_path)}
                    title="Remover anexo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de preview ampliado */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-w-6xl max-h-[95vh] w-full flex flex-col items-center">
            <div className="absolute top-0 right-0 flex gap-2 z-10">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Baixar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <img
              src={url}
              alt={attachment.file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg mt-12"
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="mt-3 text-center text-white">
              <p className="text-sm font-medium">{attachment.file_name}</p>
              <p className="text-xs text-white/70">
                {formatSize(attachment.file_size)} • {format(new Date(attachment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FileAttachment({ attachment, readOnly, onDelete, url }: AttachmentItemProps & { url: string | null }) {
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const canPreview = isPreviewable(attachment.file_type);

  const getFileIcon = (type: string) => {
    if (type.includes("pdf") || type.includes("document")) return FileText;
    return File;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (!url) return;
    
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error("Erro ao baixar arquivo");
    } finally {
      setDownloading(false);
    }
  };

  const Icon = getFileIcon(attachment.file_type);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group">
      <div className="h-12 w-12 flex items-center justify-center bg-background rounded border flex-shrink-0">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(attachment.file_size)} • {format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {canPreview && url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPreviewOpen(true)}
            title="Visualizar"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            disabled={downloading}
            title="Baixar arquivo"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={() => onDelete(attachment.id, attachment.file_path)}
            title="Remover anexo"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {canPreview && (
        <DocumentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fileName={attachment.file_name}
          fileType={attachment.file_type}
          fileSize={attachment.file_size}
          getUrl={() => getRequestAttachmentUrl(attachment.file_path)}
        />
      )}
    </div>
  );
}

function AttachmentItem({ attachment, readOnly, onDelete }: AttachmentItemProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    getRequestAttachmentUrl(attachment.file_path).then((signedUrl) => {
      if (mounted) {
        setUrl(signedUrl);
        setLoading(false);
      }
    });
    
    return () => { mounted = false; };
  }, [attachment.file_path]);

  const isImage = attachment.file_type.startsWith("image/");

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  // Hide attachment if file doesn't exist in storage
  if (!url) {
    return null;
  }

  if (isImage) {
    return <ImageAttachment attachment={attachment} readOnly={readOnly} onDelete={onDelete} url={url} />;
  }

  return <FileAttachment attachment={attachment} readOnly={readOnly} onDelete={onDelete} url={url} />;
}

export function RequestAttachmentUploader({ requestId, readOnly = false }: RequestAttachmentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { data: attachments, isLoading } = useRequestAttachments(requestId);
  const uploadAttachment = useUploadRequestAttachment();
  const deleteAttachment = useDeleteRequestAttachment();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede o limite de 10MB`);
        continue;
      }
      
      try {
        await uploadAttachment.mutateAsync({ requestId, file });
        toast.success(`${file.name} enviado com sucesso`);
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
  }, [requestId, uploadAttachment]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDelete = async (id: string, filePath: string) => {
    try {
      await deleteAttachment.mutateAsync({ id, filePath, requestId });
      toast.success("Anexo removido");
    } catch {
      toast.error("Erro ao remover anexo");
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando anexos...</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Anexos ({attachments?.length || 0})
      </h4>

      {!readOnly && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="request-file-upload"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label htmlFor="request-file-upload" className="cursor-pointer">
            <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste arquivos ou <span className="text-primary">clique para selecionar</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Máximo 10MB por arquivo</p>
          </label>
        </div>
      )}

      {attachments && attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              readOnly={readOnly}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
