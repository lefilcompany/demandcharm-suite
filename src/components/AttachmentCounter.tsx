import { useAttachments } from "@/hooks/useAttachments";
import { Badge } from "@/components/ui/badge";

interface AttachmentCounterProps {
  demandId: string;
}

export function AttachmentCounter({ demandId }: AttachmentCounterProps) {
  const { data: attachments } = useAttachments(demandId);
  const count = attachments?.length || 0;

  if (count === 0) return null;

  return (
    <Badge variant="secondary" className="text-xs font-normal">
      {count} {count === 1 ? "arquivo" : "arquivos"}
    </Badge>
  );
}
