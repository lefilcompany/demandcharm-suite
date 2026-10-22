import type { AppNotification } from "@/hooks/useNotifications";

const listeners = new Set<(notification: AppNotification) => void>();

export const notificationNewsBus = {
  open(notification: AppNotification) {
    if (notification.type !== "product_update") return false;
    listeners.forEach((listener) => listener(notification));
    return true;
  },
  subscribe(listener: (notification: AppNotification) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};