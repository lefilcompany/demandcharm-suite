import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, FileText, Image, File, Trash2, Loader2, Maximize2, Eye, Copy, GitBranch } from "lucide-react";
import { downloadFileFromUrl, copyImageToClipboard } from "@/lib/fileDownloadUtils";
import { useAttachments, useUploadAttachment, useDeleteAttachment, getAttachmentUrl } from "@/hooks/useAttachments";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { buildPublicDemandUrl } from "@/lib/demandShareUtils";
import { DocumentPreviewDialog, isPreviewable } from "@/components/DocumentPreviewDialog";
import { Checkbox } from "@/components/ui/checkbox";

const SKIP_ATTACH_DELETE_KEY = "skip-attachment-delete-confirm";

interface AttachmentUploaderProps {
  demandId: string;
  readOnly?: boolean;
  demandTitle?: string;
  demandCreatedBy?: string;
  showSubdemandAttachments?: boolean;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function DeleteConfirmPopover({ children, onConfirm }: { children: React.ReactNode; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (localStorage.getItem(SKIP_ATTACH_DELETE_KEY) === "true") {
      e.preventDefault();
      onConfirm();
    }
  };

  const handleConfirm = () => {
    if (dontAsk) {
      localStorage.setItem(SKIP_ATTACH_DELETE_KEY, "true");
    }
    setOpen(false);
    onConfirm();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={handleClick}>{children}</PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto p-3">
        <p className="text-sm font-medium mb-2">Remover este anexo?</p>
        <p className="text-xs text-muted-foreground mb-3">Esta ação é irreversível.</p>
        <div className="flex items-center gap-2 mb-3">
          <Checkbox id="skip-attach-delete" checked={dontAsk} onCheckedChange={(v) => setDontAsk(!!v)} />
          <label htmlFor="skip-attach-delete" className="text-xs text-muted-foreground cursor-pointer">Não perguntar novamente</label>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={handleConfirm}>Remover</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

function AttachmentItem({ attachment, readOnly, onDelete, onAvailabilityChange }: AttachmentItemProps & { onAvailabilityChange?: (id: string, available: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    getAttachmentUrl(attachment.file_path).then((signedUrl) => {
      if (mounted) {
        setUrl(signedUrl);
        setLoading(false);
        onAvailabilityChange?.(attachment.id, !!signedUrl);
      }
    });
    
    return () => { mounted = false; };
  }, [attachment.file_path]);

  // Hide attachment if file doesn't exist in storage
  if (!loading && !url) {
    return null;
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return Image;
    if (type.includes("pdf") || type.includes("document")) return FileText;
    return File;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const Icon = getFileIcon(attachment.file_type);
  const isImage = attachment.file_type.startsWith("image/");
  const canPreview = isPreviewable(attachment.file_type);

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group">
        {loading ? (
          <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isImage && url ? (
          <img
            src={url}
            alt={attachment.file_name}
            className="h-10 w-10 object-cover rounded flex-shrink-0"
          />
        ) : (
          <Icon className="h-10 w-10 p-2 bg-background rounded flex-shrink-0" />
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatSize(attachment.file_size)} • {format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {isImage && url && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(true)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {canPreview && !isImage && url && (
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
              onClick={() => downloadFileFromUrl(url, attachment.file_name)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          
          {!readOnly && (
            <DeleteConfirmPopover onConfirm={() => onDelete(attachment.id, attachment.file_path)}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-destructive/20"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </DeleteConfirmPopover>
          )}
        </div>
      </div>

      {isImage && (
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-4 flex flex-col items-center justify-center gap-3">
            {url && (
              <img
                src={url}
                alt={attachment.file_name}
                className="max-w-full max-h-[78vh] object-contain rounded-md"
              />
            )}
            <div className="flex items-center justify-between w-full px-1">
              <span className="text-sm text-muted-foreground truncate max-w-[70%]">
                {attachment.file_name}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!url || copying} onClick={async () => {
                  if (!url) return;
                  setCopying(true);
                  try { await copyImageToClipboard(url); } finally { setCopying(false); }
                }}>
                  {copying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={() => url && downloadFileFromUrl(url, attachment.file_name)}>
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
          getUrl={() => getAttachmentUrl(attachment.file_path)}
        />
      )}
    </>
  );
}

export function AttachmentUploader({ demandId, readOnly = false, demandTitle, demandCreatedBy, showSubdemandAttachments = false }: AttachmentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [availableIds, setAvailableIds] = useState<Set<string>>(new Set());
  const { data: attachments, isLoading } = useAttachments(demandId);

  // Fetch subdemand attachments when viewing a parent demand
  const { data: subdemandAttachments } = useQuery({
    queryKey: ["subdemand-attachments", demandId],
    queryFn: async () => {
      // Get subdemands
      const { data: subdemands, error: subError } = await supabase
        .from("demands")
        .select("id, title, board_sequence_number")
        .eq("parent_demand_id", demandId)
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (subError || !subdemands || subdemands.length === 0) return [];

      const subIds = subdemands.map(s => s.id);
      const { data: attachData, error: attachError } = await supabase
        .from("demand_attachments")
        .select("*")
        .in("demand_id", subIds)
        .is("interaction_id", null)
        .order("created_at", { ascending: false });
      if (attachError) return [];

      return (attachData || []).map(a => ({
        ...a,
        subdemandTitle: subdemands.find(s => s.id === a.demand_id)?.title || "Subdemanda",
        subdemandSequence: subdemands.find(s => s.id === a.demand_id)?.board_sequence_number,
      }));
    },
    enabled: showSubdemandAttachments,
  });

  const handleAvailabilityChange = useCallback((id: string, available: boolean) => {
    setAvailableIds(prev => {
      const next = new Set(prev);
      if (available) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const { user } = useAuth();

  const notifyCreator = useCallback(async (fileName: string) => {
    // Only notify if creator exists, is different from uploader, and we have demand info
    if (!demandCreatedBy || !demandTitle || demandCreatedBy === user?.id) return;

    try {
      // Get uploader name
      const { data: uploaderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id || "")
        .single();

      const uploaderName = uploaderProfile?.full_name || "Alguém";

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: demandCreatedBy,
        title: "Novo arquivo anexado",
        message: `${uploaderName} anexou "${fileName}" na demanda "${demandTitle}"`,
        type: "info",
        link: `/demands/${demandId}`,
      });

      // Send email notification with public link
      const publicUrl = await buildPublicDemandUrl(demandId, user?.id || "");
      await supabase.functions.invoke("send-email", {
        body: {
          to: demandCreatedBy,
          subject: `📎 Novo arquivo anexado: ${demandTitle}`,
          template: "notification",
          templateData: {
            title: "Novo arquivo anexado à demanda",
            message: `${uploaderName} anexou o arquivo "${fileName}" na demanda "${demandTitle}".`,
            actionUrl: publicUrl,
            actionText: "Ver Demanda",
            type: "info" as const,
          },
        },
      });
    } catch (error) {
      console.error("Error notifying creator about attachment:", error);
    }
  }, [demandCreatedBy, demandTitle, demandId, user?.id]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede o limite de 10MB`);
        continue;
      }
      
      try {
        await uploadAttachment.mutateAsync({ demandId, file });
        toast.success(`${file.name} enviado com sucesso`);
        
        // Notify demand creator
        await notifyCreator(file.name);
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
  }, [demandId, uploadAttachment, notifyCreator]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDelete = async (id: string, filePath: string) => {
    try {
      await deleteAttachment.mutateAsync({ id, filePath, demandId });
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
        Anexos ({availableIds.size})
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
            id="file-upload"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Arraste arquivos ou <span className="text-primary">clique para selecionar</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Máximo 10MB por arquivo</p>
          </label>
        </div>
      )}

      {attachments && attachments.length > 0 && (
        <div className="max-h-[228px] overflow-y-auto pr-1 space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              readOnly={readOnly}
              onDelete={handleDelete}
              onAvailabilityChange={handleAvailabilityChange}
            />
          ))}
        </div>
      )}

      {/* Subdemand attachments */}
      {showSubdemandAttachments && subdemandAttachments && subdemandAttachments.length > 0 && (() => {
        // Group by subdemand
        const grouped = subdemandAttachments.reduce<Record<string, { title: string; attachments: typeof subdemandAttachments }>>((acc, a) => {
          if (!acc[a.demand_id]) {
            acc[a.demand_id] = { title: a.subdemandTitle, attachments: [] };
          }
          acc[a.demand_id].attachments.push(a);
          return acc;
        }, {});

        return (
          <div className="space-y-3 mt-4 pt-4 border-t border-border">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              Anexos de Subdemandas
            </h5>
            {Object.entries(grouped).map(([subId, group]) => (
              <div key={subId} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground pl-1">
                  {group.title}
                </p>
                <div className="space-y-2">
                  {group.attachments.map((attachment) => (
                    <AttachmentItem
                      key={attachment.id}
                      attachment={attachment}
                      readOnly={true}
                      onDelete={handleDelete}
                      onAvailabilityChange={handleAvailabilityChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
