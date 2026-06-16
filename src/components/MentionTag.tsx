import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MentionTagProps {
  name: string;
  userId?: string;
  onRemove?: () => void;
  readOnly?: boolean;
  className?: string;
}

export function MentionTag({ name, userId, onRemove, readOnly = false, className }: MentionTagProps) {
  return (
    <span
      data-mention-user-id={userId}
      contentEditable={false}
      className={cn(
        "inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 select-none align-baseline",
        className
      )}
    >
      @{name}
      {!readOnly && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="hover:bg-primary/20 rounded-full p-0.5 ml-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
