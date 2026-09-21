import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DemoRequestStatus = "new" | "contacted" | "scheduled" | "won" | "lost" | "archived";
export type DemoRequestEmailStatus = "pending" | "sent" | "failed";

export interface DemoRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string;
  role: string | null;
  team_size: string | null;
  message: string | null;
  status: DemoRequestStatus;
  internal_notes: string | null;
  source_path: string | null;
  email_status: DemoRequestEmailStatus;
  email_error: string | null;
  provider_message_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useDemoRequests() {
  return useQuery({
    queryKey: ["admin-demo-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_requests")
        .select("id, name, email, phone, company, role, team_size, message, status, internal_notes, source_path, email_status, email_error, provider_message_id, reviewed_by, reviewed_at, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DemoRequest[];
    },
    staleTime: 30_000,
  });
}

export function useUpdateDemoRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, internal_notes }: { id: string; status: DemoRequestStatus; internal_notes: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("demo_requests")
        .update({
          status,
          internal_notes: internal_notes.trim() || null,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-demo-requests"] }),
  });
}
