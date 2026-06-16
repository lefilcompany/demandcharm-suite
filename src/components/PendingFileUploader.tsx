import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, X, Image, FileText, File } from "lucide-react";

export interface PendingFile {
  id: string;
  file: File;
  preview: string | null;
}

interface PendingFileUploaderProps {
  files: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  maxSizeMB?: number;
  disabled?: boolean;
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

export function PendingFileUploader({
  files,
  onFilesChange,
  maxSizeMB = 10,
  disabled = false,
}: PendingFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [inputId] = useState(() => `pending-file-upload-${Math.random().toString(36).slice(2)}`);
  const maxSize = maxSizeMB * 1024 * 1024;

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;

      const newFiles: PendingFile[] = [];
      
      for (const file of Array.from(fileList)) {
        if (file.size > maxSize) {
          continue;
        }

        const preview = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null;

        newFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview,
        });
      }

      onFilesChange([...files, ...newFiles]);
    },
    [files, maxSize, disabled, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = files.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange]
  );

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id={inputId}
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <label
          htmlFor={inputId}
          className={`block ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <Paperclip className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">
            Arraste arquivos ou{" "}
            <span className="text-primary">clique para selecionar</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Máximo {maxSizeMB}MB por arquivo
          </p>
        </label>
      </div>

      {files.length > 0 && (
        <ScrollArea className="max-h-48">
        <div className="space-y-1 pr-2">
          {files.map((pf) => {
            const Icon = getFileIcon(pf.file.type);
            const isImage = pf.file.type.startsWith("image/");

            return (
              <div
                key={pf.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 group"
              >
                {isImage && pf.preview ? (
                  <img
                    src={pf.preview}
                    alt={pf.file.name}
                    className="h-10 w-10 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{pf.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(pf.file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(pf.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
        </ScrollArea>
      )}
    </div>
  );
}
