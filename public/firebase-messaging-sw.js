// Firebase Messaging Service Worker for SoMA
// Loaded at /firebase-messaging-sw.js under scope /firebase-cloud-messaging-push-scope/.
// Config comes from /firebase-config.generated.js so frontend and worker stay in sync.

importScripts("/firebase-config.generated.js");

if (!self.__FIREBASE_CONFIG__) {
  console.log("[FCM SW] Missing Firebase config; messaging disabled.");
} else {
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

  if (!firebase.apps.length) {
    firebase.initializeApp(self.__FIREBASE_CONFIG__);
  }

  const messaging = firebase.messaging();

  // Backend sends `notification` payload, so FCM shows the notification itself.
  // Log only sanitized metadata here.
  messaging.onBackgroundMessage((payload) => {
    console.log("[FCM SW] Background message received", {
      type: payload?.data?.type,
      notificationType: payload?.data?.notificationType,
    });
  });
}

// Log notification close (analytics hook, optional).
self.addEventListener("notificationclose", (event) => {
  console.log("[FCM SW] Notification closed", event.notification?.tag);
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
