import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contract {
  id: string;
  team_id: string;
  original_content: string | null;
  processed_content: string | null;
  file_url: string | null;
  file_name: string | null;
  status: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useContract(teamId: string | null) {
  return useQuery({
    queryKey: ["contract", teamId],
    queryFn: async () => {
      if (!teamId) return null;

      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Contract | null;
    },
    enabled: !!teamId,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, originalContent, fileName }: { 
      teamId: string; 
      originalContent: string; 
      fileName?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create contract record
      const { data: contract, error: insertError } = await supabase
        .from("contracts")
        .insert({
          team_id: teamId,
          original_content: originalContent,
          file_name: fileName,
          status: "pending",
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function to process with AI
      const { error: fnError } = await supabase.functions.invoke("process-contract", {
        body: { 
          contractId: contract.id, 
          originalContent 
        },
      });

      if (fnError) {
        // Update status to error
        await supabase
          .from("contracts")
          .update({ status: "error" })
          .eq("id", contract.id);
        throw fnError;
      }

      return contract;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract", variables.teamId] });
      toast.success("Contrato enviado para processamento!");
    },
    onError: (error: Error) => {
      console.error("Error creating contract:", error);
      toast.error("Erro ao processar contrato: " + error.message);
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, teamId }: { contractId: string; teamId: string }) => {
      const { error } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contractId);

      if (error) throw error;
      return { teamId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contract", data.teamId] });
      toast.success("Contrato excluído com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Error deleting contract:", error);
      toast.error("Erro ao excluir contrato");
    },
  });
}
