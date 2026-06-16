import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { usePlansModal } from "@/contexts/PlansModalContext";
import { showPlanLimitToast } from "@/lib/planLimitErrors";

export interface Board {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  monthly_demand_limit: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardData {
  team_id: string;
  name: string;
  description?: string | null;
  services?: Array<{ service_id: string; monthly_limit: number }>;
  stages?: Array<{ name: string; color: string; adjustment_type?: "none" | "internal" | "external" }>;
  members?: Array<{ user_id: string; role: "admin" | "moderator" | "executor" | "requester" }>;
}

export interface UpdateBoardData {
  id: string;
  name?: string;
  description?: string | null;
  monthly_demand_limit?: number;
}

// Fetch boards for a team (only boards the user belongs to or is team admin/mod)
export function useBoards(teamId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["boards", teamId, user?.id],
    queryFn: async () => {
      if (!teamId || !user) return [];

      // The RLS policy now handles visibility properly
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .eq("team_id", teamId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Erro ao buscar quadros:", error);
        throw error;
      }
      return data as Board[];
    },
    enabled: !!user && !!teamId,
  });
}

// Fetch a single board
export function useBoard(boardId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      if (!boardId) return null;

      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .eq("id", boardId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar quadro:", error);
        throw error;
      }
      return data as Board | null;
    },
    enabled: !!user && !!boardId,
  });
}

// Create a new board using RPC (atomic operation with services)
export function useCreateBoard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { openPlans } = usePlansModal();

  return useMutation({
    mutationFn: async (input: CreateBoardData): Promise<Board> => {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      if (!input.team_id) {
        throw new Error("Equipe não selecionada");
      }

      if (!input.name || input.name.trim().length === 0) {
        throw new Error("Nome do quadro é obrigatório");
      }

      // Build services array for RPC
      const servicesJson = (input.services || []).map(s => ({
        service_id: s.service_id,
        monthly_limit: s.monthly_limit || 0
      }));

      const stagesJson = (input.stages || []).map(s => ({
        name: s.name,
        color: s.color,
        adjustment_type: s.adjustment_type || "none",
      }));

      const membersJson = (input.members || []).map(m => ({
        user_id: m.user_id,
        role: m.role,
      }));

      const { data, error } = await supabase.rpc("create_board_with_services", {
        p_team_id: input.team_id,
        p_name: input.name.trim(),
        p_description: input.description?.trim() || null,
        p_services: servicesJson,
        p_stages: stagesJson.length ? stagesJson : null,
        p_members: membersJson,
      });

      if (error) {
        console.error("Erro ao criar quadro:", error);

        // Plan-limit errors raised by BEFORE INSERT triggers
        if (error.message && /PLAN_LIMIT_/.test(error.message)) {
          throw new Error(error.message);
        }

        // Map error codes to user-friendly messages
        if (error.code === "42501" || error.message?.includes("Permission denied")) {
          throw new Error("Você não tem permissão para criar quadros nesta equipe. É necessário ser administrador ou moderador.");
        }
        if (error.code === "23505" || error.message?.includes("already exists")) {
          throw new Error("Já existe um quadro com este nome nesta equipe");
        }
        if (error.code === "PGRST301" || error.message?.includes("Not authenticated")) {
          throw new Error("Sessão expirada. Por favor, faça login novamente.");
        }
        throw new Error(error.message || "Erro ao criar quadro");
      }

      if (!data) {
        throw new Error("Quadro criado mas dados não retornados");
      }

      return data as Board;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["boards", data.team_id] });
      queryClient.invalidateQueries({ queryKey: ["board-members"] });
      toast.success("Quadro criado com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Erro no mutation de criar quadro:", error);
      if (showPlanLimitToast(error, openPlans)) return;
      toast.error(error.message || "Erro ao criar quadro");
    },
  });
}

// Update a board
export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateBoardData): Promise<Board> => {
      if (!input.id) {
        throw new Error("ID do quadro é obrigatório");
      }

      const updateData: Record<string, unknown> = {};
      
      if (input.name !== undefined) {
        updateData.name = input.name.trim();
      }
      if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
      }
      if (input.monthly_demand_limit !== undefined) {
        updateData.monthly_demand_limit = input.monthly_demand_limit;
      }

      const { data, error } = await supabase
        .from("boards")
        .update(updateData as never)
        .eq("id", input.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar quadro:", error);
        throw new Error(error.message || "Erro ao atualizar quadro");
      }

      return data as Board;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["boards", data.team_id] });
      queryClient.invalidateQueries({ queryKey: ["board", data.id] });
      toast.success("Quadro atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar quadro");
    },
  });
}

// Delete a board
export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boardId, teamId }: { boardId: string; teamId: string }) => {
      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", boardId);

      if (error) {
        console.error("Erro ao excluir quadro:", error);
        throw new Error(error.message || "Erro ao excluir quadro");
      }

      return { boardId, teamId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["boards", data.teamId] });
      toast.success("Quadro excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao excluir quadro");
    },
  });
}
