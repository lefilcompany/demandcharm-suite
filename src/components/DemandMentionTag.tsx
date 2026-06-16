import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDemandCode } from "@/lib/demandCodeUtils";

interface DemandMentionTagProps {
  demandId: string;
  code: string;
  readOnly?: boolean;
  className?: string;
}

export function DemandMentionTag({ demandId, code, readOnly, className }: DemandMentionTagProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/demands/${demandId}`);
  };

  return (
    <span
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-0.5 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 cursor-pointer hover:bg-cyan-500/20 transition-colors select-none align-baseline",
        className
      )}
    >
      {code}
    </span>
  );
}
