import { cn } from "@/lib/utils";
import { MEMBER_KIND_LABEL, type MemberKind } from "@/lib/access/profiles";

/** Shows nothing for internal members; a quiet tag for external/contractor. */
export function MemberKindBadge({ kind, className }: { kind?: MemberKind | null; className?: string }) {
  if (!kind || kind === "internal") return null;
  return (
    <span className={cn(
      "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium leading-4 whitespace-nowrap",
      kind === "client_external" ? "border-primary/40 text-primary" : "border-border text-muted-foreground",
      className,
    )}>
      {kind === "client_external" ? "Externo" : MEMBER_KIND_LABEL[kind]}
    </span>
  );
}
