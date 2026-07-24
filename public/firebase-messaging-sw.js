// Firebase Messaging Service Worker for SoMA
// Loaded at /firebase-messaging-sw.js under scope /firebase-cloud-messaging-push-scope/.
// The app registers this worker with the Firebase public runtime config in the
// script URL. No build-time generated Firebase file is used in production.

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

const firebaseConfig = readConfigFromScriptUrl();
self.__FCM_CONFIG_SOURCE__ = firebaseConfig ? "script-url" : "missing";

if (!firebaseConfig) {
  console.warn("[FCM SW] Missing Firebase config in script URL; messaging disabled.", {
    hasScriptParams: new URL(self.location.href).searchParams.size > 0,
  });
} else {
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  console.log("[FCM SW] Messaging initialized", { source: self.__FCM_CONFIG_SOURCE__ });

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
