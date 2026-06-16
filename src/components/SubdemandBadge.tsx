import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDemandCode } from "@/lib/demandCodeUtils";

interface SubdemandBadgeProps {
  title: string;
  statusName?: string;
  statusColor?: string;
  sequenceNumber?: number | null;
  onClick?: () => void;
  className?: string;
}

export function SubdemandBadge({
  title,
  statusName,
  statusColor,
  sequenceNumber,
  onClick,
  className,
}: SubdemandBadgeProps) {
  const color = statusColor || "#6B7280";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 cursor-pointer hover:opacity-80 transition-opacity text-xs py-1 px-2 max-w-[200px]",
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color: color,
      }}
      onClick={onClick}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {sequenceNumber && (
        <span className="font-mono text-[10px] opacity-70">
          {formatDemandCode(sequenceNumber)}
        </span>
      )}
      <span className="truncate">{title}</span>
    </Badge>
  );
}
