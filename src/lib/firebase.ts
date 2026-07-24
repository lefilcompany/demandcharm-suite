import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";

const FCM_SW_URL = "/firebase-messaging-sw.js";
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";
const FIREBASE_PUBLIC_CONFIG_FUNCTION = "firebase-public-config";

export type PushRegistrationResult =
  | {
      ok: true;
      token: string;
      registration: ServiceWorkerRegistration;
    }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "insecure-context"
        | "permission-denied"
        | "missing-config"
        | "service-worker-error"
        | "token-error";
      error?: string;
    };

interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

type FirebaseConfigCandidate = {
  config: Partial<FirebasePublicConfig>;
  vapidKey: string | null;
  source: "inline" | "generated" | "supabase";
};

type FirebaseRuntimeConfig = {
  config: FirebasePublicConfig | null;
  vapidKey: string | null;
  missing: string[];
  source: string;
};

const CONFIG_FIELDS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const satisfies readonly (keyof FirebasePublicConfig)[];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readInlineCandidate(): FirebaseConfigCandidate {
  const env = import.meta.env;
  return {
    config: {
      apiKey: stringValue(env.VITE_FIREBASE_API_KEY),
      authDomain: stringValue(env.VITE_FIREBASE_AUTH_DOMAIN),
      projectId: stringValue(env.VITE_FIREBASE_PROJECT_ID),
      storageBucket: stringValue(env.VITE_FIREBASE_STORAGE_BUCKET),
      messagingSenderId: stringValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      appId: stringValue(env.VITE_FIREBASE_APP_ID),
    },
    vapidKey: stringValue(env.VITE_FIREBASE_VAPID_KEY) || null,
    source: "inline",
  };
}

function normalizeCandidate(
  value: unknown,
  source: FirebaseConfigCandidate["source"],
): FirebaseConfigCandidate {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    config: {
      apiKey: stringValue(record.apiKey),
      authDomain: stringValue(record.authDomain),
      projectId: stringValue(record.projectId),
      storageBucket: stringValue(record.storageBucket),
      messagingSenderId: stringValue(record.messagingSenderId),
      appId: stringValue(record.appId),
    },
    vapidKey: stringValue(record.vapidKey) || null,
    source,
  };
}

function mergeCandidates(candidates: FirebaseConfigCandidate[]): FirebaseRuntimeConfig {
  const merged: Partial<FirebasePublicConfig> = {};
  const usedSources = new Set<string>();

  for (const field of CONFIG_FIELDS) {
    for (const candidate of candidates) {
      const value = stringValue(candidate.config[field]);
      if (!value) continue;
      merged[field] = value;
      usedSources.add(candidate.source);
      break;
    }
  }

  let vapidKey: string | null = null;
  for (const candidate of candidates) {
    if (!candidate.vapidKey) continue;
    vapidKey = candidate.vapidKey;
    usedSources.add(candidate.source);
    break;
  }

  const missing: string[] = [];
  for (const field of CONFIG_FIELDS) {
    if (!stringValue(merged[field])) missing.push(field);
  }
  if (!vapidKey) missing.push("vapidKey");

  return {
    config: missing.some((field) => field !== "vapidKey")
      ? null
      : (merged as FirebasePublicConfig),
    vapidKey,
    missing,
    source: usedSources.size > 0 ? [...usedSources].join("+") : "none",
  };
}

function parseGeneratedAssignment(text: string): unknown {
  const match = text.match(/self\.__FIREBASE_CONFIG__\s*=\s*([\s\S]*?);\s*$/m);
  if (!match?.[1] || match[1].trim() === "null") return null;
  try {
    return JSON.parse(match[1]);
  } catch (err) {
    console.error("[FCM] generated config parse failed", (err as Error)?.message);
    return null;
  }
}

let generatedConfigPromise: Promise<FirebaseConfigCandidate> | null = null;
let supabaseConfigPromise: Promise<FirebaseConfigCandidate> | null = null;

async function loadGeneratedCandidate(cacheBust = false): Promise<FirebaseConfigCandidate> {
  if (typeof window === "undefined") return normalizeCandidate(null, "generated");
  try {
    const suffix = cacheBust ? `?t=${Date.now()}` : "";
    const response = await fetch(`/firebase-config.generated.js${suffix}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return normalizeCandidate(null, "generated");
    return normalizeCandidate(parseGeneratedAssignment(await response.text()), "generated");
  } catch (err) {
    console.error("[FCM] generated config load failed", (err as Error)?.message);
    return normalizeCandidate(null, "generated");
  }
}

async function loadSupabaseCandidate(): Promise<FirebaseConfigCandidate> {
  const supabaseUrl = stringValue(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const publishableKey = stringValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!supabaseUrl) return normalizeCandidate(null, "supabase");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${FIREBASE_PUBLIC_CONFIG_FUNCTION}`,
      {
        method: "GET",
        cache: "no-store",
        headers: publishableKey ? { apikey: publishableKey } : undefined,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.warn("[FCM] runtime config endpoint unavailable", response.status);
      return normalizeCandidate(null, "supabase");
    }
    return normalizeCandidate(await response.json(), "supabase");
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[FCM] runtime config load failed", message);
    return normalizeCandidate(null, "supabase");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveRuntimeConfig(forceRefresh = false): Promise<FirebaseRuntimeConfig> {
  if (forceRefresh) {
    generatedConfigPromise = null;
    supabaseConfigPromise = null;
  }

  const inline = readInlineCandidate();
  if (!generatedConfigPromise) {
    generatedConfigPromise = loadGeneratedCandidate(forceRefresh);
  }
  const generated = await generatedConfigPromise;
  const localRuntime = mergeCandidates([inline, generated]);
  if (localRuntime.missing.length === 0) return localRuntime;

  if (!supabaseConfigPromise) supabaseConfigPromise = loadSupabaseCandidate();
  const remote = await supabaseConfigPromise;
  const runtime = mergeCandidates([inline, generated, remote]);

  // Do not permanently cache an incomplete/error response. A later retry can
  // succeed immediately after the Edge Function or its secrets are deployed.
  if (runtime.missing.length > 0) supabaseConfigPromise = null;
  return runtime;
}

export async function checkFirebasePushConfig(): Promise<{
  ready: boolean;
  missing: string[];
  source: string;
}> {
  const runtime = await resolveRuntimeConfig(true);
  return {
    ready: runtime.missing.length === 0,
    missing: runtime.missing,
    source: runtime.source,
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedMessaging: Messaging | null = null;
let messagingSupportedPromise: Promise<boolean> | null = null;

function getFirebaseApp(cfg: FirebasePublicConfig | null): FirebaseApp | null {
  if (!cfg) return null;
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(cfg);
  return cachedApp;
}

async function getFirebaseMessaging(runtime?: FirebaseRuntimeConfig): Promise<Messaging | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const resolved = runtime ?? (await resolveRuntimeConfig());
  const app = getFirebaseApp(resolved.config);
  if (!app) return null;
  if (!messagingSupportedPromise) messagingSupportedPromise = isSupported().catch(() => false);
  const supported = await messagingSupportedPromise;
  if (!supported) return null;
  if (!cachedMessaging) {
    try {
      cachedMessaging = getMessaging(app);
    } catch (err) {
      console.error("[FCM] getMessaging failed", (err as Error)?.message);
      return null;
    }
  }
  return cachedMessaging;
}

function buildFcmServiceWorkerUrl(config: FirebasePublicConfig): string {
  const url = new URL(FCM_SW_URL, window.location.origin);
  for (const field of CONFIG_FIELDS) url.searchParams.set(field, config[field]);
  return `${url.pathname}${url.search}`;
}

async function waitForExpectedActive(
  registration: ServiceWorkerRegistration,
  expectedScriptUrl: string,
): Promise<void> {
  const expected = new URL(expectedScriptUrl, window.location.origin).href;
  if (registration.active?.scriptURL === expected) return;

  await new Promise<void>((resolve, reject) => {
    const watched = new WeakSet<ServiceWorker>();
    let intervalId = 0;
    let timeoutId = 0;

    const cleanup = () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      registration.removeEventListener("updatefound", onUpdateFound);
    };

    const check = () => {
      if (registration.active?.scriptURL === expected) {
        cleanup();
        resolve();
      }
    };

    const watch = (worker: ServiceWorker | null) => {
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      worker.addEventListener("statechange", check);
    };

    const onUpdateFound = () => {
      watch(registration.installing);
      check();
    };

    registration.addEventListener("updatefound", onUpdateFound);
    watch(registration.installing);
    watch(registration.waiting);
    watch(registration.active);
    intervalId = window.setInterval(check, 100);
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("sw activation timeout"));
    }, 15000);
    check();
  });
}

async function cleanupStaleFcmRegistrations(expectedScriptHref: string): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const script =
          reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || "";
        if (!script) return;
        if (!script.includes("firebase-messaging-sw.js")) return;
        if (script === expectedScriptHref) return;
        try {
          await reg.unregister();
          console.log("[FCM] unregistered stale SW", script);
        } catch (err) {
          console.warn("[FCM] failed to unregister stale SW", (err as Error)?.message);
        }
      }),
    );
  } catch (err) {
    console.warn("[FCM] cleanup stale registrations failed", (err as Error)?.message);
  }
}

async function resetPushSubscription(
  registration: ServiceWorkerRegistration | null,
): Promise<void> {
  if (registration) {
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        console.log("[FCM] unsubscribed stale PushSubscription");
      }
    } catch (err) {
      console.warn("[FCM] unsubscribe failed", (err as Error)?.message);
    }
  }
  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) {
      await deleteToken(messaging).catch(() => false);
    }
  } catch (err) {
    console.warn("[FCM] deleteToken during reset failed", (err as Error)?.message);
  }
}

async function getOrRegisterFcmSw(
  config: FirebasePublicConfig,
): Promise<ServiceWorkerRegistration> {
  // The public config is included in the script URL so the classic worker can
  // initialize synchronously even when Lovable did not inject Firebase vars at build time.
  const scriptUrl = buildFcmServiceWorkerUrl(config);
  const expected = new URL(scriptUrl, window.location.origin).href;
  await cleanupStaleFcmRegistrations(expected);
  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  if (existing?.active?.scriptURL === expected) return existing;

  const registration = await navigator.serviceWorker.register(scriptUrl, {
    scope: FCM_SW_SCOPE,
    updateViaCache: "none",
  });
  await waitForExpectedActive(registration, expected);
  return registration;
}

/**
 * Hard-reset the FCM push registration for this browser:
 *  - unsubscribe the browser PushSubscription
 *  - delete the Firebase Messaging token from IndexedDB
 *  - unregister the firebase-messaging-sw.js service worker
 *
 * Safe to call even when nothing is registered. Use this to recover from a
 * stale subscription bound to an old VAPID key.
 */
export async function resetPushRegistration(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const script =
        reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || "";
      if (!script.includes("firebase-messaging-sw.js")) continue;
      await resetPushSubscription(reg);
      try {
        await reg.unregister();
      } catch (err) {
        console.warn("[FCM] reset unregister failed", (err as Error)?.message);
      }
    }
  } catch (err) {
    console.warn("[FCM] resetPushRegistration failed", (err as Error)?.message);
  } finally {
    cachedMessaging = null;
  }
}

function shortToken(token: string): string {
  return `${token.slice(0, 6)}…`;
}

export async function requestNotificationPermission(): Promise<PushRegistrationResult> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return { ok: false, reason: "unsupported" };
  }
  if (!window.isSecureContext) return { ok: false, reason: "insecure-context" };

  const runtime = await resolveRuntimeConfig(true);
  if (!runtime.config || !runtime.vapidKey || runtime.missing.length > 0) {
    return {
      ok: false,
      reason: "missing-config",
      error: runtime.missing.join(", "),
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission-denied" };

  let registration: ServiceWorkerRegistration;
  try {
    registration = await getOrRegisterFcmSw(runtime.config);
  } catch (err) {
    return {
      ok: false,
      reason: "service-worker-error",
      error: (err as Error)?.message,
    };
  }

  const messaging = await getFirebaseMessaging(runtime);
  if (!messaging) return { ok: false, reason: "unsupported" };

  try {
    const token = await getToken(messaging, {
      vapidKey: runtime.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: "token-error", error: "empty token" };
    console.log("[FCM] token obtained", shortToken(token));
    return { ok: true, token, registration };
  } catch (err) {
    return {
      ok: false,
      reason: "token-error",
      error: (err as Error)?.message,
    };
  }
}

/** Obtain the current FCM token without requesting permission again. */
export async function getCurrentFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  const runtime = await resolveRuntimeConfig();
  if (!runtime.config || !runtime.vapidKey || runtime.missing.length > 0) return null;
  try {
    const registration = await getOrRegisterFcmSw(runtime.config);
    const messaging = await getFirebaseMessaging(runtime);
    if (!messaging) return null;
    const token = await getToken(messaging, {
      vapidKey: runtime.vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.error("[FCM] getCurrentFcmToken error", (err as Error)?.message);
    return null;
  }
}

export async function subscribeToForegroundMessages(
  callback: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    try {
      callback(payload);
    } catch (err) {
      console.error("[FCM] foreground handler error", (err as Error)?.message);
    }
  });
}

export async function deleteFcmToken(): Promise<boolean> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return false;
  try {
    return await deleteToken(messaging);
  } catch (err) {
    console.error("[FCM] deleteToken error", (err as Error)?.message);
    return false;
  }
}
