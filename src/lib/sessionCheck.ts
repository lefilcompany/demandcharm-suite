/**
 * Controls the "you are already signed in" confirmation screen.
 *
 * The flag lives in sessionStorage, so it resets whenever the user opens the
 * app in a new browser session/tab — which is exactly when we want to confirm
 * which account they intend to use.
 */

const KEY = "soma:sessionChecked";

export function isSessionChecked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "true";
  } catch {
    return true; // never block access if storage is unavailable
  }
}

export function markSessionChecked() {
  try {
    sessionStorage.setItem(KEY, "true");
  } catch {
    // ignore
  }
}

export function clearSessionChecked() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Builds the /auth URL that shows the account confirmation card. */
export function sessionCheckRedirect(pathname: string, search: string): string {
  const next = `${pathname}${search || ""}`;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) {
    return "/auth";
  }
  return `/auth?next=${encodeURIComponent(next)}`;
}
