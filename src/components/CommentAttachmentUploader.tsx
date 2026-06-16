import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { toast } from "sonner";

interface CommentAttachmentUploaderProps {
  pendingFiles: File[];
  onFilesChange: (files: File[]) => void;
  maxSizeMB?: number;
  disabled?: boolean;
  buttonOnly?: boolean;
  filesListOnly?: boolean;
}

const MAX_FILES = 20;

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType.includes("pdf") || fileType.includes("document")) return FileText;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CommentAttachmentUploader({
  pendingFiles,
  onFilesChange,
  maxSizeMB = 10,
  disabled = false,
  buttonOnly = false,
  filesListOnly = false,
}: CommentAttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxBytes = maxSizeMB * 1024 * 1024;
    const validFiles: File[] = [];

    for (const file of files) {
      if (pendingFiles.length + validFiles.length >= MAX_FILES) {
        toast.warning(`Máximo de ${MAX_FILES} arquivos permitido`);
        break;
      }
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" excede ${maxSizeMB}MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesChange([...pendingFiles, ...validFiles]);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...pendingFiles];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  // Hidden file input (always needed)
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      onChange={handleFileSelect}
      className="hidden"
      disabled={disabled}
    />
  );

  // Button to trigger file selection
  const attachButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => inputRef.current?.click()}
      disabled={disabled || pendingFiles.length >= MAX_FILES}
      className="text-muted-foreground hover:text-foreground"
    >
      <Paperclip className="h-4 w-4 mr-1" />
      Anexar
    </Button>
  );

  // List of pending files
  const filesList = pendingFiles.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {pendingFiles.map((file, index) => {
        const Icon = getFileIcon(file.type);
        return (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md text-sm"
          >
            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate max-w-[120px]">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatSize(file.size)}
            </span>
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="text-muted-foreground hover:text-destructive"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );

  // Render only button
  if (buttonOnly) {
    return (
      <>
        {fileInput}
        {attachButton}
      </>
    );
  }

  // Render only files list
  if (filesListOnly) {
    return <>{filesList}</>;
  }

  // Render full component (default)
  return (
    <div className="space-y-2">
      {fileInput}
      <div className="flex items-center gap-2">
        {attachButton}
        {pendingFiles.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {pendingFiles.length}/{MAX_FILES} arquivos
          </span>
        )}
      </div>
      {filesList}
    </div>
  );
}
