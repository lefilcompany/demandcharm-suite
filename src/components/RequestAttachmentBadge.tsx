import { Paperclip } from "lucide-react";
import { useRequestAttachments } from "@/hooks/useRequestAttachments";

interface RequestAttachmentBadgeProps {
  requestId: string;
}

export function RequestAttachmentBadge({ requestId }: RequestAttachmentBadgeProps) {
  const { data: attachments } = useRequestAttachments(requestId);
  
  if (!attachments || attachments.length === 0) return null;
  
  return (
    <span className="inline-flex items-center text-xs text-muted-foreground">
      <Paperclip className="h-3 w-3 mr-1" />
      {attachments.length} anexo{attachments.length > 1 ? "s" : ""}
    </span>
  );
}
