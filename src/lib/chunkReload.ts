/**
 * Handles "Failed to fetch dynamically imported module" errors.
 *
 * They happen when the page running in the browser belongs to an older build
 * than the one on the server: the hosting removes the previous hashed chunks on
 * every publish, so a lazy route of the old page 404s and React.lazy throws —
 * leaving a blank screen.
 *
 * Recovery: if a newer service worker is already waiting, activate it first
 * (so the reload is served by the new version), then reload once. The guard
 * key prevents an infinite reload loop if the chunk is genuinely missing.
 */

const GUARD_KEY = "soma:chunkReloadAt";
const GUARD_WINDOW_MS = 30_000;
const ACTIVATION_TIMEOUT_MS = 3_000;

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

export function isChunkLoadError(message: string): boolean {
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Unable to preload CSS")
  );
}

/** Asks a waiting service worker (newer version) to take over before reloading. */
async function activateWaitingWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const waiting = registration?.waiting;
    if (!waiting) return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, ACTIVATION_TIMEOUT_MS);
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  } catch {
    // Best effort: a plain reload still fetches the current page from the server.
  }
}

let reloading = false;

/** Reloads the page served by the current build (new worker first, if any). */
export function reloadForFreshBuild(): void {
  if (reloading) return;
  reloading = true;
  void activateWaitingWorker().finally(() => {
    window.location.reload();
  });
}

export function installChunkReloadHandler() {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    // Only swallow the error when we are actually reloading. Calling
    // preventDefault() without reloading makes the dynamic import resolve to
    // `undefined`, which crashes React.lazy with "reading 'default'" (blank page).
    if (shouldReload()) {
      event.preventDefault();
      reloadForFreshBuild();
    }
  });

  window.addEventListener("error", (event) => {
    const msg = String((event as ErrorEvent).message || "");
    if (isChunkLoadError(msg) && shouldReload()) reloadForFreshBuild();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? "");
    if (isChunkLoadError(msg) && shouldReload()) reloadForFreshBuild();
  });
}
