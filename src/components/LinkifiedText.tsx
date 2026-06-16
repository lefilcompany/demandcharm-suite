import { parseLinks, ParsedLink } from "@/lib/mentionUtils";
import { cn } from "@/lib/utils";
interface LinkifiedTextProps {
  text: string;
  className?: string;
}
export function LinkifiedText({
  text,
  className
}: LinkifiedTextProps) {
  const parts = parseLinks(text);
  return <span className={cn("inline", className)}>
      {parts.map((part, index) => {
      if (typeof part === "string") {
        return <span key={`text-${index}`}>{part}</span>;
      }
      return <a key={`link-${index}`} href={part.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all cursor-pointer" onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        window.open(part.url, '_blank', 'noopener,noreferrer');
      }}>
            {part.displayText}
          </a>;
    })}
    </span>;
}