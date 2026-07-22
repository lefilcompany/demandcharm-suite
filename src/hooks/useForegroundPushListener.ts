import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { subscribeToForegroundMessages } from "@/lib/firebase";

function normalizeLink(link: unknown): string | null {
  if (typeof link !== "string" || link.length === 0) return null;
  try {
    const url = new URL(link, window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/**
 * Mount once inside the authenticated layout. Displays a toast when a push
 * message arrives while the app is in the foreground.
 */
export function useForegroundPushListener() {
  const { user } = useAuth();
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (mountedRef.current) return;
    mountedRef.current = true;

    let unsub: (() => void) | null = null;
    let cancelled = false;

    subscribeToForegroundMessages((payload) => {
      const title = payload.notification?.title || "Nova notificação";
      const body = payload.notification?.body || "";
      const rawLink =
        (payload.fcmOptions as { link?: string } | undefined)?.link ??
        (payload.data as Record<string, string> | undefined)?.link;
      const link = normalizeLink(rawLink);
      toast(title, {
        description: body,
        action: link
          ? {
              label: "Ver",
              onClick: () => {
                window.location.href = link;
              },
            }
          : undefined,
      });
    })
      .then((fn) => {
        if (cancelled) fn();
        else unsub = fn;
      })
      .catch((err) => {
        console.error("[FCM] foreground subscribe failed", err?.message);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (unsub) unsub();
    };
  }, [user?.id]);
}
