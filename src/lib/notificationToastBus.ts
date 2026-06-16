import type { AppNotification } from "@/hooks/useNotifications";

type Listener = (n: AppNotification) => void;

const listeners = new Set<Listener>();

export const notificationToastBus = {
  emit(n: AppNotification) {
    listeners.forEach((l) => l(n));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
