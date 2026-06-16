import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/MentionInput";
import { PendingFile } from "@/components/InlineFileUploader";
import { Send, Paperclip, ClipboardPaste, X, Image, FileText, File as FileIcon, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DemandChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onInputChange: () => void;
  onBlur: () => void;
  pendingFiles: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  isSending: boolean;
  boardId: string;
  channel: "general" | "internal";
  placeholder?: string;
}

const MAX_SIZE = 10 * 1024 * 1024;

export function DemandChatInput({
  value,
  onChange,
  onSend,
  onInputChange,
  onBlur,
  pendingFiles,
  onFilesChange,
  isSending,
  boardId,
  channel,
  placeholder,
}: DemandChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isSending) {
        onSend();
      }
    }
  };

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    const newFiles: PendingFile[] = [];
    for (const file of fileArray) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede 10MB`);
        continue;
      }
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      newFiles.push({ id: crypto.randomUUID(), file, preview });
    }
    if (newFiles.length > 0) {
      onFilesChange([...pendingFiles, ...newFiles]);
    }
  }, [pendingFiles, onFilesChange]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  }, [handleFiles]);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handlePasteClick = useCallback(() => {
    navigator.clipboard.read?.().then(async (items) => {
      const imageFiles: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const ext = type.split("/")[1] || "png";
            const file = new File([blob], `colado-${Date.now()}.${ext}`, { type });
            imageFiles.push(file);
          }
        }
      }
      if (imageFiles.length > 0) {
        handleFiles(imageFiles);
        toast.success(`${imageFiles.length} imagem(ns) colada(s)`);
      } else {
        toast.info("Nenhuma imagem na área de transferência");
      }
    }).catch(() => toast.info("Use Ctrl+V para colar imagens"));
  }, [handleFiles]);

  const removeFile = (id: string) => {
    const file = pendingFiles.find(f => f.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    onFilesChange(pendingFiles.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn(
      "border-t bg-background/80 backdrop-blur-sm px-1.5 py-2",
      channel === "internal" && "border-t-blue-500/30"
    )}>
      {/* Pending files preview - compact chips */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingFiles.map((pf) => {
            const isImage = pf.file.type.startsWith("image/");
            return (
              <div
                key={pf.id}
                className="flex items-center gap-1.5 bg-muted/60 rounded-md pl-1 pr-1 py-0.5 text-xs group"
              >
                {isImage && pf.preview ? (
                  <img src={pf.preview} alt="" className="h-5 w-5 rounded object-cover" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-muted-foreground max-w-[100px] truncate">{pf.file.name}</span>
                <span className="text-muted-foreground/50">{formatSize(pf.file.size)}</span>
                <button
                  onClick={() => removeFile(pf.id)}
                  className="ml-0.5 text-muted-foreground/60 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input row with embedded action buttons */}
      <div className="flex items-end gap-1.5">
        {/* Attach + Paste buttons - compact */}
        <div className="flex items-center gap-0.5 pb-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.json,.xml"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors",
                  isSending && "opacity-40 pointer-events-none"
                )}
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Anexar arquivo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handlePasteClick}
                disabled={isSending}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors",
                  isSending && "opacity-40 pointer-events-none"
                )}
              >
                <ClipboardPaste className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Colar imagem</TooltipContent>
          </Tooltip>
        </div>

        {/* Text input */}
        <div className="flex-1 min-w-0" onKeyDown={handleKeyDown}>
          <MentionInput
            placeholder={placeholder || (channel === "internal"
              ? "Mensagem interna..."
              : "Escreva uma mensagem...")}
            value={value}
            boardId={boardId}
            onChange={(val) => {
              onChange(val);
              onInputChange();
            }}
            onBlur={onBlur}
            className={cn(
              "text-sm min-h-[36px] max-h-[100px] resize-none rounded-lg border-muted-foreground/20",
              channel === "internal" && "border-blue-500/30 focus-within:border-blue-500/50"
            )}
          />
        </div>

        {/* Send button */}
        <Button
          size="icon"
          onClick={onSend}
          disabled={!value.trim() || isSending}
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg mb-0.5",
            channel === "internal" && "bg-blue-600 hover:bg-blue-700"
          )}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
