import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kanban-specific skeleton that mirrors the real columns layout, so the
 * Kanban page never falls back to a centered spinner / blank area.
 */
export function KanbanSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex h-full w-full gap-3 overflow-hidden animate-fade-in">
      {Array.from({ length: columns }).map((_, c) => (
        <div
          key={c}
          className="flex h-full w-72 shrink-0 flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-2"
        >
          <div className="flex items-center justify-between px-1 py-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 + (c % 2) }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 bg-background p-2 shadow-sm"
              >
                <Skeleton className="mb-2 h-3 w-3/4" />
                <Skeleton className="mb-2 h-3 w-1/2" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default KanbanSkeleton;
