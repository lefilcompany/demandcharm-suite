/**
 * Handles "Failed to fetch dynamically imported module" errors.
 *
 * They happen when the browser still holds an old index.html (cached) while the
 * server already serves a new build: the hashed chunk filenames no longer exist
 * and every lazy route fails with a 404 — including /auth, leaving a blank page.
 *
 * Fix: reload once (bypassing the cached HTML). The guard key prevents an
 * infinite reload loop if the chunk is genuinely missing.
 */

const GUARD_KEY = "soma:chunkReloadAt";
const GUARD_WINDOW_MS = 30_000;

function shouldReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
    if (Date.now() - last < GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

function isChunkLoadError(message: string): boolean {
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

function reloadFresh() {
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}

export function installChunkReloadHandler() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    if (shouldReload()) reloadFresh();
  });

  window.addEventListener("error", (event) => {
    const msg = String((event as ErrorEvent).message || "");
    if (isChunkLoadError(msg) && shouldReload()) reloadFresh();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? "");
    if (isChunkLoadError(msg) && shouldReload()) reloadFresh();
  });
}
