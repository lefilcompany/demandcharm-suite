/**
 * Persists the last logged-in user's email so we can show a friendly
 * message after they clear browser storage / cookies.
 *
 * Strategy:
 *  - localStorage (fast, easy)
 *  - Cookie with 1 year expiry as fallback (survives some "clear site data"
 *    flows that wipe localStorage but not cookies, and vice-versa)
 */

const STORAGE_KEY = "soma:lastEmail";
const COOKIE_KEY = "soma_last_email";
const METHOD_KEY = "soma:lastLoginMethod";
const METHOD_AT_KEY = "soma:lastLoginAt";
const ONE_YEAR_DAYS = 365;

export type LastLoginMethod = "password" | "google";

/** Recently used accounts, shown as a Google-style account picker on /auth. */
export interface RecentAccount {
  email: string;
  name?: string;
  avatarUrl?: string;
  method: LastLoginMethod;
  at: number;
}

const ACCOUNTS_KEY = "soma:recentAccounts";
const MAX_ACCOUNTS = 4;

export function getRecentAccounts(): RecentAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.email === "string")
      .map((a) => ({
        email: String(a.email).toLowerCase(),
        name: typeof a.name === "string" ? a.name : undefined,
        avatarUrl: typeof a.avatarUrl === "string" ? a.avatarUrl : undefined,
        method: (a.method === "google" ? "google" : "password") as LastLoginMethod,
        at: typeof a.at === "number" ? a.at : 0,
      }))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

export function rememberAccount(account: Omit<RecentAccount, "at"> & { at?: number }) {
  if (!account?.email) return;
  const email = account.email.trim().toLowerCase();
  try {
    const existing = getRecentAccounts().filter((a) => a.email !== email);
    const previous = getRecentAccounts().find((a) => a.email === email);
    const next: RecentAccount[] = [
      {
        email,
        name: account.name || previous?.name,
        avatarUrl: account.avatarUrl || previous?.avatarUrl,
        method: account.method,
        at: account.at ?? Date.now(),
      },
      ...existing,
    ].slice(0, MAX_ACCOUNTS);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function forgetAccount(email: string) {
  try {
    const target = email.trim().toLowerCase();
    const next = getRecentAccounts().filter((a) => a.email !== target);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function rememberLastLoginMethod(method: LastLoginMethod) {
  try {
    localStorage.setItem(METHOD_KEY, method);
    localStorage.setItem(METHOD_AT_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

export function getLastLoginMethod(): LastLoginMethod | null {
  try {
    const v = localStorage.getItem(METHOD_KEY);
    if (v === "password" || v === "google") return v;
  } catch {
    // ignore
  }
  return null;
}

export function getLastLoginAt(): number | null {
  try {
    const v = localStorage.getItem(METHOD_AT_KEY);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** True if the last login was via password and happened within the given window (default 30 days). */
export function isRecentPasswordLogin(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): boolean {
  if (getLastLoginMethod() !== "password") return false;
  const at = getLastLoginAt();
  if (!at) return false;
  return Date.now() - at < maxAgeMs;
}

function setCookie(name: string, value: string, days: number) {
  try {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

function getCookie(name: string): string | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`));
    if (!match) return null;
    return decodeURIComponent(match.split("=")[1] || "");
  } catch {
    return null;
  }
}

export function rememberLastEmail(email: string) {
  if (!email) return;
  const trimmed = email.trim().toLowerCase();
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // ignore
  }
  setCookie(COOKIE_KEY, trimmed, ONE_YEAR_DAYS);
}

export function getLastEmail(): string | null {
  try {
    const fromLs = localStorage.getItem(STORAGE_KEY);
    if (fromLs) return fromLs;
  } catch {
    // ignore
  }
  return getCookie(COOKIE_KEY);
}

/**
 * Returns true if we have a remembered email but no active Supabase session
 * token in localStorage — strong signal that the user cleared cache/cookies.
 */
export function looksLikeClearedCache(): boolean {
  const last = getLastEmail();
  if (!last) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.includes("auth-token")) {
        return false; // session still present
      }
    }
    return true;
  } catch {
    return false;
  }
}
