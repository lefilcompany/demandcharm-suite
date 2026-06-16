// Firebase Messaging Service Worker for SoMA
// Version: 2.0.0 - Enhanced with notification grouping and vibration
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAz0LHEMeuvAfP-NaiSk3jw1VNUIc0Ct14",
  authDomain: "soma-notifications.firebaseapp.com",
  projectId: "soma-notifications",
  storageBucket: "soma-notifications.firebasestorage.app",
  messagingSenderId: "471966948414",
  appId: "1:471966948414:web:4d33c7c8e2976a0fbec56f"
});

const messaging = firebase.messaging();

// Notification type to icon mapping
const getNotificationIcon = (type) => {
  // All notifications use the same icon for now
  // Can be extended to use different icons based on type
  return '/favicon.png';
};

// Get notification tag for grouping similar notifications
const getNotificationTag = (data) => {
  const type = data?.type || 'general';
  const demandId = data?.demandId;
  
  // Group by type and demand if available
  if (demandId) {
    return `soma-${type}-${demandId}`;
  }
  return `soma-${type}`;
};

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const data = payload.data || {};
  const notificationType = data.type || data.notificationType || 'general';
  
  const notificationTitle = payload.notification?.title || 'SoMA';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: getNotificationIcon(notificationType),
    badge: '/favicon.png',
    tag: getNotificationTag(data),
    data: {
      ...data,
      link: data.link || '/',
    },
    // Vibration pattern: [vibrate, pause, vibrate]
    vibrate: [200, 100, 200],
    // Require user interaction for important notifications
    requireInteraction: ['deadline_overdue', 'deadline_approaching', 'adjustment_request'].includes(notificationType),
    // Actions for quick response (optional, browser support varies)
    actions: data.link ? [
      {
        action: 'open',
        title: 'Ver',
      },
      {
        action: 'dismiss',
        title: 'Dispensar',
      }
    ] : [],
    // Timestamp
    timestamp: Date.now(),
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  const action = event.action;
  const notification = event.notification;
  
  notification.close();
  
  // Handle dismiss action
  if (action === 'dismiss') {
    return;
  }

  // Get the URL to open
  const urlToOpen = notification.data?.link || '/';
  const fullUrl = urlToOpen.startsWith('http') ? urlToOpen : `${self.location.origin}${urlToOpen}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window on the same origin
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            if ('navigate' in focusedClient) {
              return focusedClient.navigate(fullUrl);
            }
          });
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event.notification.tag);
});

// Service worker install event
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installing...');
  self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activating...');
  event.waitUntil(clients.claim());
});
