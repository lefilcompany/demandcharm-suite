import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteFcmToken,
  getCurrentFcmToken,
  requestNotificationPermission,
} from "@/lib/firebase";

const DEVICE_ID_KEY = "soma:fcm_device_id";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 0) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

async function registerToken(
  token: string,
  deviceId: string,
  userAgent: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("register_fcm_token", {
    p_token: token,
    p_device_id: deviceId,
    p_user_agent: userAgent,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermission | null>(null);
  const deviceIdRef = useRef<string>("");

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator;
    setIsSupported(supported);
    if (supported) {
      setPermissionStatus(Notification.permission);
      deviceIdRef.current = getOrCreateDeviceId();
    }
  }, []);

  // Load existing row for this device and rotate the token if it changed.
  useEffect(() => {
    if (!user?.id || !isSupported) return;
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("fcm_tokens")
        .select("id, token")
        .eq("user_id", user.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[push] load token failed", error.message);
        return;
      }
      if (!data) {
        setFcmToken(null);
        return;
      }
      setFcmToken(data.token);

      // Rotate silently if permission is still granted and Firebase issued a new token.
      if (Notification.permission !== "granted") return;
      try {
        const current = await getCurrentFcmToken();
        if (cancelled || !current) return;
        if (current === data.token) {
          await supabase
            .from("fcm_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", data.id);
          return;
        }
        const res = await registerToken(current, deviceId, navigator.userAgent);
        if (!res.ok) {
          console.error("[push] rotate failed", res.error);
          return;
        }
        if (!cancelled) setFcmToken(current);
      } catch (err) {
        console.error("[push] rotation error", (err as Error)?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isSupported]);

  const enablePushNotifications = useCallback(async () => {
    if (!isSupported || !user?.id) {
      toast.error("Notificações push não suportadas neste navegador");
      return null;
    }
    const deviceId = deviceIdRef.current || getOrCreateDeviceId();
    deviceIdRef.current = deviceId;

    setIsLoading(true);
    try {
      const result = await requestNotificationPermission();
      if (result.ok === false) {
        setPermissionStatus(
          typeof Notification !== "undefined" ? Notification.permission : null,
        );
        switch (result.reason) {
          case "permission-denied":
            toast.error("Permissão negada. Habilite nas configurações do navegador.");
            break;
          case "insecure-context":
            toast.error("Push requer HTTPS.");
            break;
          case "missing-config":
            toast.error("Notificações push indisponíveis no momento.");
            break;
          case "unsupported":
            toast.error("Notificações push não suportadas neste navegador.");
            break;
          default:
            toast.error("Erro ao ativar notificações push");
        }
        return null;
      }

      const reg = await registerToken(result.token, deviceId, navigator.userAgent);
      if (!reg.ok) {
        console.error("[push] server registration failed", reg.error);
        toast.error("Não foi possível registrar o dispositivo. Tente novamente.");
        return null;
      }

      setFcmToken(result.token);
      setPermissionStatus("granted");
      toast.success("Notificações push ativadas com sucesso!");
      return result.token;
    } catch (err) {
      console.error("[push] enable error", (err as Error)?.message);
      toast.error("Erro ao ativar notificações push");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user?.id]);

  const disablePushNotifications = useCallback(async () => {
    if (!user?.id) return;
    const deviceId = deviceIdRef.current || getOrCreateDeviceId();
    try {
      const { error } = await supabase
        .from("fcm_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("device_id", deviceId);
      if (error) {
        console.error("[push] disable delete failed", error.message);
        toast.error("Erro ao desativar notificações push");
        return;
      }
      try {
        await deleteFcmToken();
      } catch (err) {
        console.warn("[push] deleteFcmToken warning", (err as Error)?.message);
      }
      setFcmToken(null);
      toast.success("Notificações push desativadas");
    } catch (err) {
      console.error("[push] disable error", (err as Error)?.message);
      toast.error("Erro ao desativar notificações push");
    }
  }, [user?.id]);

  return {
    fcmToken,
    isSupported,
    isLoading,
    permissionStatus,
    isEnabled: permissionStatus === "granted" && !!fcmToken,
    enablePushNotifications,
    disablePushNotifications,
  };
}
