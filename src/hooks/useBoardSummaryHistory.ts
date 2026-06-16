import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BoardSummaryHistoryItem {
  id: string;
  board_id: string;
  created_by: string;
  summary_text: string;
  analytics_data: {
    board: { name: string; description: string | null; monthlyLimit: number | null };
    period: { start: string; end: string; days: number };
    demands: {
      total: number;
      delivered: number;
      onTime: number;
      late: number;
      overdue: number;
      avgDeliveryDays: number;
      byStatus: { status: string; count: number }[];
      byPriority: { priority: string; count: number }[];
    };
    members: {
      name: string;
      role: string;
      demandCount: number;
      completedCount: number;
      completionRate: number;
      avgTimeHours: number;
    }[];
    requesters: {
      name: string;
      requestCount: number;
      pending: number;
      approved: number;
      rejected: number;
      avgPerWeek: number;
    }[];
    timeTracking: {
      totalHours: number;
      byExecutor: { name: string; hours: number; demandCount: number }[];
      avgHoursPerDemand: number;
    };
  };
  created_at: string;
  share_token?: string;
}

export function useBoardSummaryHistory(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useQuery({
    queryKey: ["board-summary-history", boardId],
    queryFn: async () => {
      if (!boardId) return [];
      
      const { data, error } = await supabase
        .from("board_summary_history")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as BoardSummaryHistoryItem[];
    },
    enabled: !!boardId,
  });

  const saveSummary = useMutation({
    mutationFn: async ({
      boardId,
      summaryText,
      analyticsData,
    }: {
      boardId: string;
      summaryText: string;
      analyticsData: BoardSummaryHistoryItem["analytics_data"];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("board_summary_history")
        .insert({
          board_id: boardId,
          created_by: user.id,
          summary_text: summaryText,
          analytics_data: analyticsData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-summary-history", boardId] });
    },
    onError: (error) => {
      console.error("Error saving summary:", error);
      toast.error("Erro ao salvar análise no histórico");
    },
  });

  const deleteSummary = useMutation({
    mutationFn: async (summaryId: string) => {
      const { error } = await supabase
        .from("board_summary_history")
        .delete()
        .eq("id", summaryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-summary-history", boardId] });
      toast.success("Análise removida do histórico");
    },
    onError: (error) => {
      console.error("Error deleting summary:", error);
      toast.error("Erro ao remover análise");
    },
  });

  const createShareToken = useMutation({
    mutationFn: async (summaryId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Generate a random token
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 32);

      const { data, error } = await supabase
        .from("board_summary_share_tokens")
        .insert({
          summary_id: summaryId,
          token,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Link de compartilhamento criado");
    },
    onError: (error) => {
      console.error("Error creating share token:", error);
      toast.error("Erro ao criar link de compartilhamento");
    },
  });

  const revokeShareToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("board_summary_share_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link de compartilhamento revogado");
    },
    onError: (error) => {
      console.error("Error revoking token:", error);
      toast.error("Erro ao revogar link");
    },
  });

  return {
    history: history || [],
    isLoading,
    saveSummary,
    deleteSummary,
    createShareToken,
    revokeShareToken,
  };
}

export async function getSharedSummary(token: string) {
  // Use RPC function that bypasses RLS for public access
  const { data, error } = await supabase
    .rpc('get_shared_board_summary', { p_token: token });

  if (error) {
    console.error("Error fetching shared summary:", error);
    throw new Error("Link inválido ou expirado");
  }

  if (!data) {
    throw new Error("Link inválido ou expirado");
  }

  return data;
}
