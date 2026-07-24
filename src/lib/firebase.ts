import { deleteApp, initializeApp, getApps, type FirebaseApp } from "firebase/app";
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
const FCM_APP_NAME = "soma-fcm";

export type PushRegistrationErrorReason =
  | "unsupported"
  | "insecure-context"
  | "permission-denied"
  | "missing-config"
  | "service-worker-failed"
  | "push-subscribe-failed"
  | "vapid-invalid"
  | "firebase-registration-failed"
  | "api-key-rejected"
  | "token-error";

export type PushRegistrationResult =
  | {
      ok: true;
      token: string;
      registration: ServiceWorkerRegistration;
    }
  | {
      ok: false;
      reason: PushRegistrationErrorReason;
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
  diagnostics?: FirebaseBackendDiagnostics;
};

type FirebaseRuntimeConfig = {
  config: FirebasePublicConfig | null;
  vapidKey: string | null;
  missing: string[];
  source: "runtime" | "none";
  diagnostics?: FirebaseBackendDiagnostics;
};

export type FirebaseConfigDiagnostics = {
  projectId: string;
  messagingSenderIdSuffix: string;
  appIdPrefix: string;
  vapidKeyHash: string;
  serviceAccountProjectConfigured: boolean | null;
  serviceAccountProjectMatchesConfig: boolean | null;
};

type FirebaseBackendDiagnostics = {
  serviceAccountProjectConfigured?: boolean;
  serviceAccountProjectMatchesConfig?: boolean | null;
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

function normalizeCandidate(value: unknown): FirebaseConfigCandidate {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const diagnosticsRecord =
    record.diagnostics && typeof record.diagnostics === "object"
      ? (record.diagnostics as Record<string, unknown>)
      : null;

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
    diagnostics: diagnosticsRecord
      ? {
          serviceAccountProjectConfigured:
            typeof diagnosticsRecord.serviceAccountProjectConfigured === "boolean"
              ? diagnosticsRecord.serviceAccountProjectConfigured
              : undefined,
          serviceAccountProjectMatchesConfig:
            typeof diagnosticsRecord.serviceAccountProjectMatchesConfig === "boolean"
              ? diagnosticsRecord.serviceAccountProjectMatchesConfig
              : diagnosticsRecord.serviceAccountProjectMatchesConfig === null
                ? null
                : undefined,
        }
      : undefined,
  };
}

function buildRuntimeConfig(candidate: FirebaseConfigCandidate): FirebaseRuntimeConfig {
  const missing: string[] = [];
  for (const field of CONFIG_FIELDS) {
    if (!stringValue(candidate.config[field])) missing.push(field);
  }
  if (!candidate.vapidKey) missing.push("vapidKey");

  return {
    config: missing.some((field) => field !== "vapidKey")
      ? null
      : (candidate.config as FirebasePublicConfig),
    vapidKey: candidate.vapidKey,
    missing,
    source: missing.length === 0 ? "runtime" : "none",
    diagnostics: candidate.diagnostics,
  };
}

let runtimeConfigPromise: Promise<FirebaseConfigCandidate> | null = null;

async function loadRuntimeCandidate(): Promise<FirebaseConfigCandidate> {
  const cloudUrl = stringValue(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const publishableKey = stringValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!cloudUrl) return normalizeCandidate(null);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${cloudUrl}/functions/v1/${FIREBASE_PUBLIC_CONFIG_FUNCTION}`,
      {
        method: "GET",
        cache: "no-store",
        headers: publishableKey ? { apikey: publishableKey } : undefined,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.warn("[FCM] runtime config endpoint unavailable", response.status);
      return normalizeCandidate(null);
    }

    return normalizeCandidate(await response.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[FCM] runtime config load failed", message);
    return normalizeCandidate(null);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveRuntimeConfig(forceRefresh = false): Promise<FirebaseRuntimeConfig> {
  if (forceRefresh) runtimeConfigPromise = null;
  if (!runtimeConfigPromise) runtimeConfigPromise = loadRuntimeCandidate();

  const runtime = buildRuntimeConfig(await runtimeConfigPromise);
  if (runtime.missing.length > 0) runtimeConfigPromise = null;
  return runtime;
}

async function shortSha256(value: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .slice(0, 6)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "indisponível";
  }
}

export async function checkFirebasePushConfig(): Promise<{
  ready: boolean;
  missing: string[];
  source: string;
  diagnostics: FirebaseConfigDiagnostics | null;
}> {
  const runtime = await resolveRuntimeConfig(true);
  const diagnostics =
    runtime.config && runtime.vapidKey
      ? {
          projectId: runtime.config.projectId,
          messagingSenderIdSuffix: runtime.config.messagingSenderId.slice(-4),
          appIdPrefix: runtime.config.appId.slice(0, 12),
          vapidKeyHash: await shortSha256(runtime.vapidKey),
          serviceAccountProjectConfigured:
            typeof runtime.diagnostics?.serviceAccountProjectConfigured === "boolean"
              ? runtime.diagnostics.serviceAccountProjectConfigured
              : null,
          serviceAccountProjectMatchesConfig:
            typeof runtime.diagnostics?.serviceAccountProjectMatchesConfig === "boolean" ||
            runtime.diagnostics?.serviceAccountProjectMatchesConfig === null
              ? runtime.diagnostics.serviceAccountProjectMatchesConfig
              : null,
        }
      : null;

  return {
    ready: runtime.missing.length === 0,
    missing: runtime.missing,
    source: runtime.source,
    diagnostics,
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAppKey = "";
let cachedMessaging: Messaging | null = null;
let messagingSupportedPromise: Promise<boolean> | null = null;

function clearCachedMessaging(): void {
  cachedMessaging = null;
}

async function getFirebaseApp(cfg: FirebasePublicConfig | null): Promise<FirebaseApp | null> {
  if (!cfg) return null;
  const appKey = `${cfg.projectId}:${cfg.appId}:${cfg.messagingSenderId}`;
  if (cachedApp && cachedAppKey === appKey) return cachedApp;

  const existing = getApps().find((app) => app.name === FCM_APP_NAME);
  if (existing && cachedAppKey !== appKey) {
    await deleteApp(existing).catch(() => undefined);
    clearCachedMessaging();
  }

  cachedApp = getApps().find((app) => app.name === FCM_APP_NAME) ?? initializeApp(cfg, FCM_APP_NAME);
  cachedAppKey = appKey;
  return cachedApp;
}

async function getFirebaseMessaging(runtime?: FirebaseRuntimeConfig): Promise<Messaging | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const resolved = runtime ?? (await resolveRuntimeConfig());
  const app = await getFirebaseApp(resolved.config);
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

function getRegistrationScriptUrl(registration: ServiceWorkerRegistration): string {
  return (
    registration.active?.scriptURL ||
    registration.waiting?.scriptURL ||
    registration.installing?.scriptURL ||
    ""
  );
}

function isFcmRegistration(registration: ServiceWorkerRegistration): boolean {
  const script = getRegistrationScriptUrl(registration);
  return script.includes("firebase-messaging-sw.js");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
        if (!isFcmRegistration(reg)) return;
        const script = getRegistrationScriptUrl(reg);
        const isExpectedScript = script === expectedScriptHref;
        const isExpectedScope = new URL(reg.scope).pathname === FCM_SW_SCOPE;
        const hasRuntimeConfig = new URL(script).searchParams.size > 0;

        if (isExpectedScript && isExpectedScope && hasRuntimeConfig) return;

        try {
          await reg.unregister();
          console.log("[FCM] unregistered stale SW", {
            scope: reg.scope,
            hasRuntimeConfig,
          });
        } catch (err) {
          console.warn("[FCM] failed to unregister stale SW", (err as Error)?.message);
        }
      }),
    );
  } catch (err) {
    console.warn("[FCM] cleanup stale registrations failed", (err as Error)?.message);
  }
}

async function getOrRegisterFcmSw(
  config: FirebasePublicConfig,
): Promise<ServiceWorkerRegistration> {
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

async function deleteBrowserFcmToken(runtime?: FirebaseRuntimeConfig): Promise<void> {
  try {
    const messaging = await getFirebaseMessaging(runtime);
    if (!messaging) return;
    await deleteToken(messaging).catch(() => false);
  } catch (err) {
    console.warn("[FCM] deleteToken during reset failed", (err as Error)?.message);
  } finally {
    clearCachedMessaging();
  }
}

async function unsubscribePushSubscription(
  registration: ServiceWorkerRegistration | null,
): Promise<void> {
  if (!registration) return;
  try {
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;
    await sub.unsubscribe();
    console.log("[FCM] unsubscribed stale PushSubscription");
  } catch (err) {
    console.warn("[FCM] unsubscribe failed", (err as Error)?.message);
  }
}

async function hardResetFcmRegistrations(runtime?: FirebaseRuntimeConfig): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  await deleteBrowserFcmToken(runtime);

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      if (!isFcmRegistration(reg)) continue;
      await unsubscribePushSubscription(reg);
      try {
        await reg.unregister();
      } catch (err) {
        console.warn("[FCM] reset unregister failed", (err as Error)?.message);
      }
    }
  } catch (err) {
    console.warn("[FCM] reset registrations failed", (err as Error)?.message);
  } finally {
    clearCachedMessaging();
    await delay(400);
  }
}

/**
 * Hard-reset the FCM push registration for this browser. This is intentionally
 * reserved for manual recovery or for one retry after a real subscribe failure.
 */
export async function resetPushRegistration(): Promise<void> {
  const runtime = await resolveRuntimeConfig(true).catch(() => undefined);
  await hardResetFcmRegistrations(runtime);
}

function shortToken(token: string): string {
  return `${token.slice(0, 6)}…`;
}

function classifyTokenError(err: unknown): PushRegistrationErrorReason {
  const error = err as { code?: string; message?: string };
  const code = error?.code || "";
  const message = error?.message || "";
  const combined = `${code} ${message}`;

  if (/vapid|applicationServerKey/i.test(combined)) return "vapid-invalid";
  if (/api-key-not-valid|api key|auth credential/i.test(combined)) return "api-key-rejected";
  if (/failed-service-worker-registration|service worker|sw registration/i.test(combined)) {
    return "service-worker-failed";
  }
  if (/token-subscribe-failed|push service|Registration failed|AbortError|subscribe/i.test(combined)) {
    return "push-subscribe-failed";
  }
  if (/registration|firebase/i.test(combined)) return "firebase-registration-failed";
  return "token-error";
}

function shouldRecoverFromTokenError(reason: PushRegistrationErrorReason): boolean {
  return reason === "push-subscribe-failed" || reason === "firebase-registration-failed";
}

async function getFcmToken(
  runtime: FirebaseRuntimeConfig,
  registration: ServiceWorkerRegistration,
): Promise<string> {
  if (!runtime.vapidKey) throw new Error("missing VAPID public key");
  const messaging = await getFirebaseMessaging(runtime);
  if (!messaging) throw new Error("messaging unsupported");

  const token = await getToken(messaging, {
    vapidKey: runtime.vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("empty token");
  return token;
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
      reason: "service-worker-failed",
      error: (err as Error)?.message,
    };
  }

  try {
    const token = await getFcmToken(runtime, registration);
    console.log("[FCM] token obtained", shortToken(token));
    return { ok: true, token, registration };
  } catch (err) {
    const firstReason = classifyTokenError(err);
    const firstMessage = (err as Error)?.message || firstReason;
    if (!shouldRecoverFromTokenError(firstReason)) {
      return { ok: false, reason: firstReason, error: firstMessage };
    }

    console.warn("[FCM] getToken failed; resetting FCM registration once", firstMessage);
    try {
      await hardResetFcmRegistrations(runtime);
      const retryRegistration = await getOrRegisterFcmSw(runtime.config);
      const token = await getFcmToken(runtime, retryRegistration);
      console.log("[FCM] token obtained after recovery", shortToken(token));
      return { ok: true, token, registration: retryRegistration };
    } catch (retryErr) {
      const retryReason = classifyTokenError(retryErr);
      return {
        ok: false,
        reason: retryReason,
        error: (retryErr as Error)?.message || firstMessage,
      };
    }
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
    return await getFcmToken(runtime, registration);
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
    const deleted = await deleteToken(messaging);
    clearCachedMessaging();
    return deleted;
  } catch (err) {
    console.error("[FCM] deleteToken error", (err as Error)?.message);
    return false;
  }
}