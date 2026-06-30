import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic list-of-rows skeleton used by tables and demand lists.
 */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col gap-2 animate-fade-in">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default ListSkeleton;
