import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = typeof window !== "undefined" && 
      "Notification" in window && 
      "serviceWorker" in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Listen for foreground messages
  useEffect(() => {
    if (!isSupported) return;

    const unsubscribe = onForegroundMessage((payload) => {
      // Show toast for foreground messages
      toast(payload.notification?.title || "Nova notificação", {
        description: payload.notification?.body,
        action: payload.data?.link ? {
          label: "Ver",
          onClick: () => window.location.href = payload.data.link,
        } : undefined,
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isSupported]);

  // Save FCM token to database
  const saveTokenToDatabase = useCallback(async (token: string) => {
    if (!user?.id) return;

    try {
      // Check if token already exists
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id, preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", "fcm_token")
        .single();

      if (existing) {
        // Update existing token
        await supabase
          .from("user_preferences")
          .update({ 
            preference_value: { token },
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        // Insert new token
        await supabase
          .from("user_preferences")
          .insert({
            user_id: user.id,
            preference_key: "fcm_token",
            preference_value: { token }
          });
      }

      console.log("FCM token saved to database");
    } catch (error) {
      console.error("Error saving FCM token:", error);
    }
  }, [user?.id]);

  // Request permission and get token
  const enablePushNotifications = useCallback(async () => {
    if (!isSupported || !user?.id) {
      toast.error("Notificações push não suportadas neste navegador");
      return null;
    }

    setIsLoading(true);

    try {
      const token = await requestNotificationPermission();
      
      if (token) {
        setFcmToken(token);
        setPermissionStatus("granted");
        await saveTokenToDatabase(token);
        toast.success("Notificações push ativadas com sucesso!");
        return token;
      } else {
        setPermissionStatus(Notification.permission);
        if (Notification.permission === "denied") {
          toast.error("Permissão negada. Habilite nas configurações do navegador.");
        } else {
          toast.error("Não foi possível ativar notificações push");
        }
        return null;
      }
    } catch (error) {
      console.error("Error enabling push notifications:", error);
      toast.error("Erro ao ativar notificações push");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user?.id, saveTokenToDatabase]);

  // Disable push notifications
  const disablePushNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Remove token from database
      await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("preference_key", "fcm_token");

      setFcmToken(null);
      toast.success("Notificações push desativadas");
    } catch (error) {
      console.error("Error disabling push notifications:", error);
      toast.error("Erro ao desativar notificações push");
    }
  }, [user?.id]);

  // Load existing token on mount
  useEffect(() => {
    if (!user?.id) return;

    const loadToken = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", "fcm_token")
        .single();

      if (data?.preference_value && typeof data.preference_value === "object") {
        const value = data.preference_value as { token?: string };
        if (value.token) {
          setFcmToken(value.token);
        }
      }
    };

    loadToken();
  }, [user?.id]);

  return {
    fcmToken,
    isSupported,
    isLoading,
    permissionStatus,
    isEnabled: !!fcmToken,
    enablePushNotifications,
    disablePushNotifications,
  };
}
