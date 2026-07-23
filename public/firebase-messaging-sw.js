// Firebase Messaging Service Worker for SoMA
// Loaded at /firebase-messaging-sw.js under scope /firebase-cloud-messaging-push-scope/.
// Prefer the generated build config, but also accept the same public config in
// the service-worker script URL. The URL fallback is used when Lovable does not
// inject Firebase variables at build time and the frontend loads them from the
// Supabase firebase-public-config Edge Function.

try {
  importScripts("/firebase-config.generated.js");
} catch (error) {
  console.warn("[FCM SW] Generated Firebase config asset unavailable", error?.message);
  self.__FIREBASE_CONFIG__ = null;
}

function readConfigFromScriptUrl() {
  try {
    const params = new URL(self.location.href).searchParams;
    const config = {
      apiKey: params.get("apiKey") || "",
      authDomain: params.get("authDomain") || "",
      projectId: params.get("projectId") || "",
      storageBucket: params.get("storageBucket") || "",
      messagingSenderId: params.get("messagingSenderId") || "",
      appId: params.get("appId") || "",
    };
    return Object.values(config).every((value) => value.length > 0) ? config : null;
  } catch {
    return null;
  }
}

function sanitizeFirebaseConfig(value) {
  if (!value || typeof value !== "object") return null;
  const config = {
    apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
    authDomain: typeof value.authDomain === "string" ? value.authDomain : "",
    projectId: typeof value.projectId === "string" ? value.projectId : "",
    storageBucket: typeof value.storageBucket === "string" ? value.storageBucket : "",
    messagingSenderId:
      typeof value.messagingSenderId === "string" ? value.messagingSenderId : "",
    appId: typeof value.appId === "string" ? value.appId : "",
  };
  return Object.values(config).every((entry) => entry.length > 0) ? config : null;
}

const firebaseConfig =
  sanitizeFirebaseConfig(self.__FIREBASE_CONFIG__) || readConfigFromScriptUrl();

if (!firebaseConfig) {
  console.log("[FCM SW] Missing Firebase config; messaging disabled.");
} else {
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  // Backend sends a `notification` payload, so FCM shows it automatically in
  // the background. Do not call showNotification() again here.
  messaging.onBackgroundMessage((payload) => {
    console.log("[FCM SW] Background message received", {
      type: payload?.data?.type,
      notificationType: payload?.data?.notificationType,
    });
  });
}

self.addEventListener("notificationclose", (event) => {
  console.log("[FCM SW] Notification closed", event.notification?.tag);
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
