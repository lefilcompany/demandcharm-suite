import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type GoogleCalendarStatus = "connected" | "revoked" | "error";

export interface GoogleCalendarConnectionStatus {
  enabled: boolean;
  status: GoogleCalendarStatus | null;
  google_account_email: string | null;
  connected_at: string | null;
  updated_at: string | null;
}

const QUERY_KEY = ["google-calendar-connection-status"];

export function useGoogleCalendarConnection() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: QUERY_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<GoogleCalendarConnectionStatus> => {
      const { data, error } = await (supabase as any).rpc(
        "get_google_calendar_connection_status",
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        enabled: row?.enabled ?? false,
        status: (row?.status as GoogleCalendarStatus) ?? null,
        google_account_email: row?.google_account_email ?? null,
        connected_at: row?.connected_at ?? null,
        updated_at: row?.updated_at ?? null,
      };
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "google-calendar-oauth-start",
        { body: { redirect_path: "/settings?tab=integrations" } },
      );
      if (error) throw error;
      if (!data?.authorization_url) throw new Error("URL de autorização indisponível");
      window.location.href = data.authorization_url as string;
    },
    onError: () => {
      toast.error("Não foi possível iniciar a conexão com o Google Calendar.");
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("google-calendar-disconnect");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google Calendar desconectado.");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => {
      toast.error("Não foi possível desconectar o Google Calendar.");
    },
  });

  return {
    data: statusQuery.data,
    isLoading: statusQuery.isLoading,
    connect,
    disconnect,
    refetch: statusQuery.refetch,
  };
}
