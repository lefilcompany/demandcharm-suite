/**
 * Prefetches the JS chunks of the most-used routes when the browser is idle.
 * Reduces the "blank board" window when the user navigates for the first time
 * to a lazy-loaded page.
 */
const importers: Array<() => Promise<unknown>> = [
  () => import("@/pages/Index"),
  () => import("@/pages/Kanban"),
  () => import("@/pages/Demands"),
  () => import("@/pages/MyDemands"),
  () => import("@/pages/TeamDemands"),
  () => import("@/pages/Boards"),
  () => import("@/pages/DemandDetail"),
  () => import("@/pages/BoardDetail"),
  () => import("@/pages/Notes"),
  () => import("@/pages/Reports"),
  () => import("@/pages/Profile"),
  () => import("@/pages/Settings"),
];

let started = false;

export function prefetchAppRoutes() {
  if (started || typeof window === "undefined") return;
  started = true;

  const run = () => {
    importers.forEach((load, index) => {
      // Stagger to keep the main thread responsive.
      setTimeout(() => {
        load().catch(() => {
          // Ignore — prefetch is best-effort.
        });
      }, index * 120);
    });
  };

  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (typeof ric === "function") {
    ric(run, { timeout: 4000 });
  } else {
    setTimeout(run, 2000);
  }
}
