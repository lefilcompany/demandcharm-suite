import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useCallback } from "react";
import { useNotificationSound } from "./useNotificationSound";
import { notificationToastBus } from "@/lib/notificationToastBus";
import { useNotificationPreferences } from "./useNotificationPreferences";
import { createRealtimeInstanceId } from "@/lib/realtimeUtils";

// Request browser notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

// Trigger device vibration (works on mobile browsers)
function triggerVibration() {
  if ("vibrate" in navigator) {
    // Pattern: vibrate 200ms, pause 100ms, vibrate 200ms
    navigator.vibrate([200, 100, 200]);
  }
}

// Show browser notification when app is not focused
function showBrowserNotification(title: string, body: string, link?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  
  // Only show if document is not visible (app not in focus)
  if (document.visibilityState === "visible") {
    return;
  }
  
  // Vibrate on mobile when notification arrives
  triggerVibration();
  
  const notification = new Notification(title, {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: "soma-notification",
    requireInteraction: false,
    vibrate: [200, 100, 200], // Vibration pattern for supported browsers
  } as NotificationOptions);
  
  notification.onclick = () => {
    window.focus();
    if (link) {
      window.location.href = link;
    }
    notification.close();
  };
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}

interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playNotificationSound } = useNotificationSound();
  const isInitialMount = useRef(true);
  const channelInstanceId = useRef(createRealtimeInstanceId());
  const { preferences } = useNotificationPreferences();
  const pushEnabled = preferences.pushNotifications !== false;

  // Request permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id, pushEnabled],
    queryFn: async () => {
      if (!user?.id) return [];
      // Respect user toggle: if in-app notifications are disabled, hide them
      if (!pushEnabled) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as AppNotification[];
    },
    enabled: !!user?.id,
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    // Mark initial mount complete after a delay to avoid playing sound on page load
    const mountTimer = setTimeout(() => {
      isInitialMount.current = false;
    }, 2000);

    const channel = supabase
      .channel(`notifications-changes-${user.id}-${channelInstanceId.current}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          // Respect user toggle: skip all alerts when in-app notifications are disabled
          if (!pushEnabled) return;
          // Play sound, vibrate, and show browser notification only after initial mount
          if (!isInitialMount.current) {
            playNotificationSound();
            
            // Vibrate on mobile (works when app is in focus too)
            triggerVibration();
            
            // Show browser push notification when app is not focused
            const newNotification = payload.new as AppNotification;
            if (newNotification) {
              notificationToastBus.emit(newNotification);
              showBrowserNotification(
                newNotification.title,
                newNotification.message,
                newNotification.link || undefined
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(mountTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, playNotificationSound, pushEnabled]);

  return {
    notifications: notifications || [],
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}

export type { AppNotification };
