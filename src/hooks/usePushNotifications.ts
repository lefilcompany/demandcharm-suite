import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteFcmToken,
  checkFirebasePushConfig,
  getCurrentFcmToken,
  requestNotificationPermission,
  resetPushRegistration as resetPushRegistrationLib,
} from "@/lib/firebase";

const DEVICE_ID_KEY = "soma:fcm_device_id";

type ConfigCheckResult = {
  ready: boolean;
  missing: string[];
  source: string;
  diagnostics?: {
    projectId: string;
    messagingSenderIdSuffix: string;
    appIdPrefix: string;
    vapidKeyHash: string;
    serviceAccountProjectConfigured: boolean | null;
    serviceAccountProjectMatchesConfig: boolean | null;
  } | null;
};

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
  const [configStatus, setConfigStatus] = useState<"checking" | "ready" | "missing">(
    "checking",
  );
  const [configMissing, setConfigMissing] = useState<string[]>([]);
  const [configSource, setConfigSource] = useState("none");
  const [configDiagnostics, setConfigDiagnostics] =
    useState<ConfigCheckResult["diagnostics"]>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermission | null>(null);
  const [lastError, setLastError] = useState<{ reason: string; message: string } | null>(null);
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

  const refreshConfigStatus = useCallback(async (): Promise<ConfigCheckResult> => {
    if (!isSupported) {
      const result = { ready: false, missing: ["browser"], source: "none" };
      setConfigStatus("missing");
      setConfigMissing(result.missing);
      setConfigSource(result.source);
      setConfigDiagnostics(null);
      return result;
    }

    setConfigStatus("checking");
    try {
      const result = await checkFirebasePushConfig();
      setConfigStatus(result.ready ? "ready" : "missing");
      setConfigMissing(result.missing);
      setConfigSource(result.source);
      setConfigDiagnostics(result.diagnostics);
      return result;
    } catch (err) {
      console.error("[push] config check failed", (err as Error)?.message);
      const result = {
        ready: false,
        missing: ["firebase-public-config"],
        source: "none",
      };
      setConfigStatus("missing");
      setConfigMissing(result.missing);
      setConfigSource(result.source);
      setConfigDiagnostics(null);
      return result;
    }
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    void refreshConfigStatus();
  }, [isSupported, refreshConfigStatus]);

  // Load existing row for this device and rotate the token if it changed.
  useEffect(() => {
    if (!user?.id || !isSupported) return;
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;

    let cancelled = false;
    void (async () => {
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
          const { error: touchError } = await supabase
            .from("fcm_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", data.id);
          if (touchError) console.error("[push] token touch failed", touchError.message);
          return;
        }
        const result = await registerToken(current, deviceId, navigator.userAgent);
        if (!result.ok) {
          console.error("[push] rotate failed", result.error);
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
      const config = await refreshConfigStatus();
      if (!config.ready) {
        toast.error(
          "Configuração FCM incompleta neste ambiente. Verifique o deploy da função firebase-public-config.",
        );
        return null;
      }

      const result = await requestNotificationPermission();
      if (result.ok === false) {
        setPermissionStatus(
          typeof Notification !== "undefined" ? Notification.permission : null,
        );
        const techMessage = result.error || "(sem detalhes técnicos)";
        console.error("[push] enable failed", { reason: result.reason, error: techMessage });
        setLastError({ reason: result.reason, message: techMessage });
        switch (result.reason) {
          case "permission-denied":
            toast.error("Permissão negada pelo navegador. Abra as configurações do site e permita notificações.");
            break;
          case "insecure-context":
            toast.error("Push requer HTTPS. Acesse a versão publicada em vez do preview local.");
            break;
          case "missing-config":
            setConfigStatus("missing");
            setConfigMissing(result.error ? result.error.split(", ") : ["firebase-config"]);
            toast.error(`Configuração FCM incompleta: ${techMessage}`);
            break;
          case "unsupported":
            toast.error("Este navegador não suporta notificações push (tente Chrome/Edge/Firefox atualizados).");
            break;
          case "service-worker-failed":
            toast.error(`Falha ao registrar o service worker do FCM: ${techMessage}`);
            break;
          case "push-subscribe-failed":
            toast.error(
              `O navegador recusou criar a inscrição push (${techMessage}). Use “Resetar registro FCM” e tente novamente.`,
            );
            break;
          case "vapid-invalid":
            toast.error(`Chave VAPID incompatível com este projeto Firebase: ${techMessage}`);
            break;
          case "api-key-rejected":
            toast.error(`Firebase recusou a API key pública: ${techMessage}`);
            break;
          case "firebase-registration-failed":
            toast.error(`Falha no registro do Firebase Messaging: ${techMessage}`);
            break;
          case "token-error":
            toast.error(`FCM recusou emitir o token: ${techMessage}`);
            break;
          default:
            toast.error(`Erro ao ativar notificações push: ${result.reason} — ${techMessage}`);
        }
        return null;
      }

      const registration = await registerToken(result.token, deviceId, navigator.userAgent);
      if (!registration.ok) {
        console.error("[push] server registration failed", registration.error);
        setLastError({ reason: "server-registration", message: registration.error || "erro desconhecido" });
        toast.error(`Não foi possível registrar o dispositivo no servidor: ${registration.error || "erro desconhecido"}`);
        return null;
      }

      setLastError(null);

      setFcmToken(result.token);
      setPermissionStatus("granted");
      setConfigStatus("ready");
      setConfigMissing([]);
      void refreshConfigStatus();
      toast.success("Notificações push ativadas com sucesso!");
      return result.token;
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      console.error("[push] enable error", err);
      setLastError({ reason: "exception", message });
      toast.error(`Erro inesperado ao ativar push: ${message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user?.id, refreshConfigStatus]);

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
      const deleted = await deleteFcmToken();
      if (!deleted) console.warn("[push] browser token could not be deleted");
      setFcmToken(null);
      toast.success("Notificações push desativadas");
    } catch (err) {
      console.error("[push] disable error", (err as Error)?.message);
      toast.error("Erro ao desativar notificações push");
    }
  }, [user?.id]);

  const resetPushRegistration = useCallback(async () => {
    const deviceId = deviceIdRef.current || getOrCreateDeviceId();
    try {
      await resetPushRegistrationLib();
      if (user?.id) {
        const { error } = await supabase
          .from("fcm_tokens")
          .delete()
          .eq("user_id", user.id)
          .eq("device_id", deviceId);
        if (error) console.warn("[push] reset db delete failed", error.message);
      }
      setFcmToken(null);
      setLastError(null);
      setPermissionStatus(
        typeof Notification !== "undefined" ? Notification.permission : null,
      );
      toast.success("Registro FCM resetado neste dispositivo. Tente ativar novamente.");
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      console.error("[push] reset error", err);
      toast.error(`Falha ao resetar registro FCM: ${message}`);
    }
  }, [user?.id]);

  return {
    fcmToken,
    isSupported,
    isLoading,
    configStatus,
    configMissing,
    configSource,
    configDiagnostics,
    permissionStatus,
    isEnabled: permissionStatus === "granted" && !!fcmToken,
    lastError,
    refreshConfigStatus,
    enablePushNotifications,
    disablePushNotifications,
    resetPushRegistration,
  };
}
