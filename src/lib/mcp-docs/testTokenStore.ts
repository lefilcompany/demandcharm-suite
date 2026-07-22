// Simple external store for the MCP Try-It access token, shared across all EndpointCards.
// Persisted in sessionStorage (cleared when the tab closes) — never in localStorage.
import { useSyncExternalStore } from "react";

const KEY = "mcp-docs.test-token";
const EMAIL_KEY = "mcp-docs.test-email";
const EXP_KEY = "mcp-docs.test-expires-at";

type Listener = () => void;
const listeners = new Set<Listener>();

function read<T = string>(k: string): T | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem(k) as unknown as T | null; } catch { return null; }
}
function write(k: string, v: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch { /* ignore */ }
}

export function setMcpTestSession(session: { access_token: string; email?: string | null; expires_at?: number | null }) {
  write(KEY, session.access_token);
  write(EMAIL_KEY, session.email ?? null);
  write(EXP_KEY, session.expires_at ? String(session.expires_at) : null);
  listeners.forEach(l => l());
}

export function clearMcpTestSession() {
  write(KEY, null); write(EMAIL_KEY, null); write(EXP_KEY, null);
  listeners.forEach(l => l());
}

function subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() {
  return JSON.stringify({
    token: read(KEY),
    email: read(EMAIL_KEY),
    expiresAt: read(EXP_KEY),
  });
}

export function useMcpTestSession() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => JSON.stringify({ token: null, email: null, expiresAt: null }));
  const { token, email, expiresAt } = JSON.parse(raw) as { token: string | null; email: string | null; expiresAt: string | null };
  return {
    token: token ?? "",
    email: email ?? "",
    expiresAt: expiresAt ? Number(expiresAt) : null,
  };
}
