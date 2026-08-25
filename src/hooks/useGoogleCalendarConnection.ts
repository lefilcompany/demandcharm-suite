import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface GoogleCalendarConnectionDTO {
  /** Feature flag is not `off`. */
  enabled: boolean;
  /** The signed-in user is inside the current rollout (backend decides). */
  available: boolean;
  connected: boolean;
  status: string | null;
  googleAccountEmail: string | null;
  connectedAt: string | null;
}

/**
 * Google Calendar connection state for the signed-in user.
 * Reads only the secure RPC `get_google_calendar_connection_status()` — never the
 * `google_calendar_connections` table directly.
 */
export function useGoogleCalendarConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<GoogleCalendarConnectionDTO>({
    queryKey: ["google-calendar-connection", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_google_calendar_connection_status")
        .maybeSingle();
      if (error) throw error;
      const row = data as {
        enabled?: boolean;
        available?: boolean;
        status?: string | null;
        google_account_email?: string | null;
        connected_at?: string | null;
      } | null;
      return {
        enabled: !!row?.enabled,
        available: !!row?.available,
        connected: row?.status === "connected",
        status: row?.status ?? null,
        googleAccountEmail: row?.google_account_email ?? null,
        connectedAt: row?.connected_at ?? null,
      };
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth-start", {
        body: { redirect_path: "/settings?tab=integrations" },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("authorization_url_missing");
      // Top-level navigation only: accounts.google.com refuses to be framed.
      if (window.top && window.top !== window.self) {
        window.top.location.assign(url);
      } else {
        window.location.assign(url);
      }
      return { url };
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("google-calendar-disconnect", { body: {} });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-connection"] });
    },
  });

  return {
    connection: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
    connect,
    disconnect,
  };
}
