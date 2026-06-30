import { Skeleton } from "@/components/ui/skeleton";

/**
 * Neutral page skeleton used as a Suspense fallback for any lazy route.
 * Keeps the panel filled while the route chunk and its initial data load,
 * preventing the "blank board" flash.
 */
export function PageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default PageSkeleton;
