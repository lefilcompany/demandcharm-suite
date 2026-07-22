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
  vapidKey?: string;
}

type FirebaseRuntimeConfig = {
  config: FirebasePublicConfig | null;
  vapidKey: string | null;
  missing: string[];
};

function readConfig(): FirebasePublicConfig | null {
  const env = import.meta.env;
  const cfg = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  if (Object.values(cfg).some((v) => !v || typeof v !== "string")) return null;
  return cfg as FirebasePublicConfig;
}

function readVapidKey(): string | null {
  const key = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  return typeof key === "string" && key.length > 0 ? key : null;
}

let generatedRuntimePromise: Promise<FirebaseRuntimeConfig> | null = null;

function parseGeneratedAssignment(text: string): FirebasePublicConfig | null {
  const match = text.match(/self\.__FIREBASE_CONFIG__\s*=\s*([\s\S]*?);\s*$/m);
  if (!match?.[1] || match[1].trim() === "null") return null;
  try {
    const parsed = JSON.parse(match[1]) as FirebasePublicConfig;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    console.error("[FCM] generated config parse failed", (err as Error)?.message);
    return null;
  }
}

function missingConfigFields(config: FirebasePublicConfig | null, vapidKey: string | null): string[] {
  const missing: string[] = [];
  if (!config?.apiKey) missing.push("apiKey");
  if (!config?.authDomain) missing.push("authDomain");
  if (!config?.projectId) missing.push("projectId");
  if (!config?.storageBucket) missing.push("storageBucket");
  if (!config?.messagingSenderId) missing.push("messagingSenderId");
  if (!config?.appId) missing.push("appId");
  if (!vapidKey) missing.push("vapidKey");
  return missing;
}

async function loadGeneratedRuntimeConfig(): Promise<FirebaseRuntimeConfig> {
  if (typeof window === "undefined") {
    return { config: null, vapidKey: null, missing: ["browser"] };
  }
  try {
    const response = await fetch("/firebase-config.generated.js", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return { config: null, vapidKey: null, missing: ["firebase-config.generated.js"] };
    }
    const generated = parseGeneratedAssignment(await response.text());
    const vapidKey = generated?.vapidKey || null;
    return {
      config: generated,
      vapidKey,
      missing: missingConfigFields(generated, vapidKey),
    };
  } catch (err) {
    console.error("[FCM] generated config load failed", (err as Error)?.message);
    return { config: null, vapidKey: null, missing: ["firebase-config.generated.js"] };
  }
}

async function resolveRuntimeConfig(): Promise<FirebaseRuntimeConfig> {
  const inlineConfig = readConfig();
  const inlineVapid = readVapidKey();
  const inlineMissing = missingConfigFields(inlineConfig, inlineVapid);
  if (inlineMissing.length === 0) {
    return { config: inlineConfig, vapidKey: inlineVapid, missing: [] };
  }

  if (!generatedRuntimePromise) generatedRuntimePromise = loadGeneratedRuntimeConfig();
  const generated = await generatedRuntimePromise;
  if (generated.missing.length === 0) return generated;
  return { config: inlineConfig || generated.config, vapidKey: inlineVapid || generated.vapidKey, missing: generated.missing };
}

export async function checkFirebasePushConfig(): Promise<{ ready: boolean; missing: string[] }> {
  const runtime = await resolveRuntimeConfig();
  return { ready: runtime.missing.length === 0, missing: runtime.missing };
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

async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const runtime = await resolveRuntimeConfig();
  const app = getFirebaseApp(runtime.config);
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

async function waitForActive(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return;
  const sw = reg.installing || reg.waiting;
  if (!sw) throw new Error("no service worker instance");
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("sw activation timeout")), 15000);
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

async function getOrRegisterFcmSw(): Promise<ServiceWorkerRegistration> {
  // Do NOT use navigator.serviceWorker.ready — it may return the PWA worker.
  const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
  if (existing) {
    await waitForActive(existing);
    return existing;
  }
  const reg = await navigator.serviceWorker.register(FCM_SW_URL, {
    scope: FCM_SW_SCOPE,
  });
  await waitForActive(reg);
  return reg;
}

function shortToken(t: string) {
  return `${t.slice(0, 6)}…`;
}

export async function requestNotificationPermission(): Promise<PushRegistrationResult> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "unsupported" };
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: "insecure-context" };
  }
  const cfg = readConfig();
  const runtime = await resolveRuntimeConfig();
  if (!runtime.config || !runtime.vapidKey || runtime.missing.length > 0) {
    return { ok: false, reason: "missing-config", error: runtime.missing.join(", ") };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permission-denied" };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await getOrRegisterFcmSw();
  } catch (err) {
    return { ok: false, reason: "service-worker-error", error: (err as Error)?.message };
  }

  const messaging = await getFirebaseMessaging();
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
    return { ok: false, reason: "token-error", error: (err as Error)?.message };
  }
}

/**
 * Obtain the current FCM token without requesting permission again.
 * Returns null if permission not granted or messaging unavailable.
 */
export async function getCurrentFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  const runtime = await resolveRuntimeConfig();
  if (!runtime.config || !runtime.vapidKey || runtime.missing.length > 0) return null;
  try {
    const registration = await getOrRegisterFcmSw();
    const messaging = await getFirebaseMessaging();
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
  callback: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => {
    try {
      callback(payload);
    } catch (err) {
      console.error("[FCM] foreground handler error", (err as Error)?.message);
    }
  });
  return unsub;
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
