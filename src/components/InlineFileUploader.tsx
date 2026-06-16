import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Image, FileText, File as FileIcon, FileSpreadsheet, FileArchive, FileCode, Presentation, Loader2, Check, AlertCircle, ImagePlus, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export type UploadStatus = 'pending' | 'uploading' | 'complete' | 'error';

export interface PendingFile {
  id: string;
  file: File;
  preview?: string;
  status?: UploadStatus;
  progress?: number;
}

interface InlineFileUploaderProps {
  pendingFiles: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
  listenToGlobalPaste?: boolean;
}

const MAX_DEFAULT_SIZE = 10 * 1024 * 1024; // 10MB

export function InlineFileUploader({
  pendingFiles,
  onFilesChange,
  maxFiles = 999,
  maxSizeMB = 10,
  accept = "image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.json,.xml",
  disabled = false,
  listenToGlobalPaste = false,
}: InlineFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const maxSize = maxSizeMB * 1024 * 1024;

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || disabled) return;
    
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    const newFiles: PendingFile[] = [];
    
    for (const file of fileArray) {
      if (pendingFiles.length + newFiles.length >= maxFiles) {
        toast.error(`Máximo de ${maxFiles} arquivos permitido`);
        break;
      }
      
      if (file.size > maxSize) {
        toast.error(`${file.name} excede o limite de ${maxSizeMB}MB`);
        continue;
      }
      
      const preview = file.type.startsWith("image/") 
        ? URL.createObjectURL(file) 
        : undefined;
        
      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
      });
    }
    
    if (newFiles.length > 0) {
      onFilesChange([...pendingFiles, ...newFiles]);
    }
  }, [pendingFiles, maxFiles, maxSize, maxSizeMB, disabled, onFilesChange]);

  // Handle paste events for clipboard images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled) return;
    
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    
    const imageFiles: File[] = [];
    
    for (const item of Array.from(clipboardItems)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Create a more descriptive name for pasted images
          const extension = item.type.split("/")[1] || "png";
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          // Create a new File with a descriptive name (File.name is read-only)
          const renamedFile = new File([file], `imagem-colada-${timestamp}.${extension}`, {
            type: file.type,
            lastModified: file.lastModified,
          });
          imageFiles.push(renamedFile);
        }
      }
    }
    
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
      toast.success(`${imageFiles.length} imagem(ns) colada(s) do clipboard`);
    }
  }, [handleFiles, disabled]);

  // Listen for global paste events if enabled
  useEffect(() => {
    if (!listenToGlobalPaste) return;
    
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [listenToGlobalPaste, handlePaste]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles, disabled]);

  const removeFile = useCallback((fileId: string) => {
    const file = pendingFiles.find(f => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFilesChange(pendingFiles.filter(f => f.id !== fileId));
  }, [pendingFiles, onFilesChange]);

  const getFileIcon = (type: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (type.startsWith("image/")) return Image;
    if (ext === "pdf" || type.includes("pdf")) return FileText;
    if (ext === "csv" || ext === "xls" || ext === "xlsx" || type.includes("spreadsheet")) return FileSpreadsheet;
    if (ext === "ppt" || ext === "pptx" || type.includes("presentation")) return Presentation;
    if (ext === "zip" || ext === "rar" || ext === "7z" || type.includes("zip") || type.includes("rar")) return FileArchive;
    if (ext === "json" || ext === "xml" || ext === "html" || ext === "css" || ext === "js" || ext === "ts") return FileCode;
    if (type.includes("document") || ext === "doc" || ext === "docx" || ext === "txt") return FileText;
    return FileIcon;
  };

  const getFileExtension = (name: string) => {
    return name.split('.').pop()?.toUpperCase() || '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePasteClick = useCallback(() => {
    if (disabled) return;
    navigator.clipboard.read?.().then(async (items) => {
      const imageFiles: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const ext = type.split("/")[1] || "png";
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const file = new File([blob], `imagem-colada-${timestamp}.${ext}`, { type, lastModified: Date.now() });
            imageFiles.push(file);
          }
        }
      }
      if (imageFiles.length > 0) {
        handleFiles(imageFiles);
        toast.success(`${imageFiles.length} imagem(ns) colada(s)`);
      } else {
        toast.info("Nenhuma imagem encontrada na área de transferência");
      }
    }).catch(() => {
      toast.info("Use Ctrl+V para colar imagens");
    });
  }, [handleFiles, disabled]);

  return (
    <div className="space-y-3">
      {/* Upload area inspired by reference */}
      <div
        className={`relative flex items-stretch gap-0 rounded-xl border-2 border-dashed transition-all ${
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border/60 hover:border-primary/40"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* Main drop zone */}
        <input
          type="file"
          id="inline-file-upload"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <label
          htmlFor="inline-file-upload"
          className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-5 px-4 cursor-pointer ${disabled ? "cursor-not-allowed" : ""}`}
        >
          <ImagePlus className="h-7 w-7 text-muted-foreground/60" />
          <span className="text-sm text-muted-foreground">
            Clique para adicionar arquivos
          </span>
          <span className="text-[11px] text-muted-foreground/50">
            JPG, PNG, PDF, DOC e outros · Máx {maxSizeMB}MB cada
          </span>
        </label>

        {/* Paste button */}
        <button
          type="button"
          onClick={handlePasteClick}
          disabled={disabled}
          className="flex flex-col items-center justify-center gap-1.5 px-5 border-l-2 border-dashed border-border/60 hover:bg-muted/50 transition-colors rounded-r-xl cursor-pointer"
        >
          <ClipboardPaste className="h-5 w-5 text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Colar arquivo</span>
        </button>
      </div>

      {/* Counter */}
      {pendingFiles.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {pendingFiles.length} arquivo(s) anexado(s)
        </p>
      )}

      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((pendingFile) => {
            const Icon = getFileIcon(pendingFile.file.type, pendingFile.file.name);
            const isImage = pendingFile.file.type.startsWith("image/");
            const extension = getFileExtension(pendingFile.file.name);
            const status = pendingFile.status || 'pending';
            const progress = pendingFile.progress ?? 0;
            const isUploading = status === 'uploading';
            const isComplete = status === 'complete';
            const isError = status === 'error';
            
            return (
              <div
                key={pendingFile.id}
                className={`relative group flex flex-col bg-muted/50 rounded-lg p-2 max-w-[220px] ${
                  isError ? 'ring-1 ring-destructive/50' : ''
                } ${isComplete ? 'ring-1 ring-green-500/50' : ''}`}
              >
                <div className="flex items-center gap-2 pr-6">
                  {isImage && pendingFile.preview ? (
                    <div className="relative">
                      <img
                        src={pendingFile.preview}
                        alt={pendingFile.file.name}
                        className={`h-10 w-10 object-cover rounded ${isUploading ? 'opacity-50' : ''}`}
                      />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      )}
                      {isComplete && (
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      {isError && (
                        <div className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5">
                          <AlertCircle className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative h-10 w-10 flex items-center justify-center bg-background rounded flex-shrink-0">
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-primary text-primary-foreground px-1 rounded">
                        {extension}
                      </span>
                      {isComplete && (
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      {isError && (
                        <div className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5">
                          <AlertCircle className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" title={pendingFile.file.name}>
                      {pendingFile.file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isUploading ? 'Enviando...' : isComplete ? 'Enviado' : isError ? 'Erro' : formatSize(pendingFile.file.size)}
                    </p>
                  </div>
                  {!isUploading && !isComplete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(pendingFile.id)}
                      disabled={disabled}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isUploading && (
                  <Progress value={progress} className="h-1 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper function to upload pending files to a demand with progress tracking
export async function uploadPendingFiles(
  demandId: string,
  pendingFiles: PendingFile[],
  uploadMutation: { mutateAsync: (data: { demandId: string; file: File; interactionId?: string }) => Promise<any> },
  interactionId?: string,
  onProgress?: (fileId: string, status: UploadStatus, progress?: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const pendingFile of pendingFiles) {
    try {
      // Notify upload started
      onProgress?.(pendingFile.id, 'uploading', 30);
      
      await uploadMutation.mutateAsync({ demandId, file: pendingFile.file, interactionId });
      
      // Notify upload complete
      onProgress?.(pendingFile.id, 'complete', 100);
      success++;
      
      // Cleanup preview URL
      if (pendingFile.preview) {
        URL.revokeObjectURL(pendingFile.preview);
      }
    } catch (error) {
      console.error(`Failed to upload ${pendingFile.file.name}:`, error);
      onProgress?.(pendingFile.id, 'error', 0);
      failed++;
    }
  }
  
  return { success, failed };
}
