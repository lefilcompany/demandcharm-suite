import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAz0LHEMeuvAfP-NaiSk3jw1VNUIc0Ct14",
  authDomain: "soma-notifications.firebaseapp.com",
  projectId: "soma-notifications",
  storageBucket: "soma-notifications.firebasestorage.app",
  messagingSenderId: "471966948414",
  appId: "1:471966948414:web:4d33c7c8e2976a0fbec56f"
};

const VAPID_KEY = "BLJfh1Op3Lx2ZaHUboq0nR83mPcCOHoq1fANzmbb4awSIaX16jP0f4rr9_feQ_IFj1-wkoGoRkq5josFXPsXqw4";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;

// Only initialize messaging in browser environment with service worker support
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error("Error initializing Firebase Messaging:", error);
      return null;
    }
  }
  
  return messaging;
}

// Wait for service worker to be ready
async function waitForServiceWorkerReady(registration: ServiceWorkerRegistration): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    const sw = registration.installing || registration.waiting || registration.active;
    
    if (registration.active) {
      resolve(registration.active);
      return;
    }
    
    if (!sw) {
      reject(new Error("No service worker found"));
      return;
    }
    
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") {
        resolve(sw);
      }
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (registration.active) {
        resolve(registration.active);
      } else {
        reject(new Error("Service worker activation timeout"));
      }
    }, 10000);
  });
}

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if running in a secure context
    if (!window.isSecureContext) {
      console.error("Push notifications require a secure context (HTTPS)");
      return null;
    }

    const permission = await Notification.requestPermission();
    
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    // Register service worker first and wait for it to be active
    console.log("Registering service worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/"
    });
    console.log("Service worker registered:", registration);
    
    // Wait for the service worker to be ready
    await waitForServiceWorkerReady(registration);
    console.log("Service worker is active");

    // Ensure we have an active registration
    const activeRegistration = await navigator.serviceWorker.ready;
    console.log("Service worker ready:", activeRegistration);

    const fcmMessaging = getFirebaseMessaging();
    if (!fcmMessaging) {
      console.error("Firebase Messaging not available");
      return null;
    }

    // Get FCM token
    console.log("Getting FCM token...");
    const token = await getToken(fcmMessaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: activeRegistration,
    });

    console.log("FCM Token obtained:", token);
    return token;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  const fcmMessaging = getFirebaseMessaging();
  if (!fcmMessaging) return null;

  return onMessage(fcmMessaging, (payload) => {
    console.log("Foreground message received:", payload);
    callback(payload);
  });
}

export { app };
