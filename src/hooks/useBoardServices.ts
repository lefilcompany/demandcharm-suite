import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BoardService {
  id: string;
  board_id: string;
  service_id: string;
  monthly_limit: number;
  created_at: string;
  service?: {
    id: string;
    name: string;
    estimated_hours: number;
    description: string | null;
  };
}

interface SelectedServiceInput {
  serviceId: string;
  monthlyLimit: number;
}

export function useBoardServices(boardId: string | null | undefined) {
  return useQuery({
    queryKey: ["board-services", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_services")
        .select(`
          *,
          service:services (
            id,
            name,
            estimated_hours,
            description
          )
        `)
        .eq("board_id", boardId!);

      if (error) throw error;
      return data as BoardService[];
    },
    enabled: !!boardId,
  });
}

export function useBoardServicesWithUsage(boardId: string | null | undefined) {
  const { data: boardServices, isLoading: servicesLoading } = useBoardServices(boardId);
  
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  // Use service IDs as part of the query key so it refetches when services change
  const serviceIds = boardServices?.map(bs => bs.service_id).sort().join(",") || "";
  
  return useQuery({
    queryKey: ["board-services-usage", boardId, month, year, serviceIds],
    queryFn: async () => {
      if (!boardServices || boardServices.length === 0) return [];
      
      const ids = boardServices.map(bs => bs.service_id);
      
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      
      const { data: demands, error } = await supabase
        .from("demands")
        .select("service_id")
        .eq("board_id", boardId!)
        .in("service_id", ids)
        .gte("created_at", startOfMonth)
        .lte("created_at", endOfMonth)
        .eq("archived", false);
      
      if (error) throw error;
      
      const countByService = demands?.reduce((acc, d) => {
        if (d.service_id) {
          acc[d.service_id] = (acc[d.service_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};
      
      return boardServices.map(bs => ({
        ...bs,
        currentCount: countByService[bs.service_id] || 0,
        remaining: bs.monthly_limit === 0 
          ? Infinity 
          : Math.max(0, bs.monthly_limit - (countByService[bs.service_id] || 0)),
        isLimitReached: bs.monthly_limit > 0 && 
          (countByService[bs.service_id] || 0) >= bs.monthly_limit,
      }));
    },
    enabled: !!boardId && !servicesLoading && !!boardServices,
  });
}

export function useAddBoardServices() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      boardId, 
      services 
    }: { 
      boardId: string; 
      services: SelectedServiceInput[];
    }) => {
      const insertData = services.map(s => ({
        board_id: boardId,
        service_id: s.serviceId,
        monthly_limit: s.monthlyLimit,
      }));
      
      const { data, error } = await supabase
        .from("board_services")
        .insert(insertData)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, { boardId }) => {
      await queryClient.invalidateQueries({ queryKey: ["board-services", boardId] });
      await queryClient.invalidateQueries({ queryKey: ["board-services-usage", boardId] });
    },
  });
}

export function useUpdateBoardServiceLimit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      monthlyLimit,
      boardId,
    }: { 
      id: string; 
      monthlyLimit: number;
      boardId: string;
    }) => {
      const { data, error } = await supabase
        .from("board_services")
        .update({ monthly_limit: monthlyLimit })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, { boardId }) => {
      await queryClient.invalidateQueries({ queryKey: ["board-services", boardId] });
      await queryClient.invalidateQueries({ queryKey: ["board-services-usage", boardId] });
      toast.success("Limite atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar limite");
    },
  });
}

export function useRemoveBoardService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      boardId,
    }: { 
      id: string;
      boardId: string;
    }) => {
      const { error } = await supabase
        .from("board_services")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: async (_, { boardId }) => {
      await queryClient.invalidateQueries({ queryKey: ["board-services", boardId] });
      await queryClient.invalidateQueries({ queryKey: ["board-services-usage", boardId] });
      toast.success("Serviço removido do quadro");
    },
    onError: () => {
      toast.error("Erro ao remover serviço");
    },
  });
}

export function useHasBoardServices(boardId: string | null | undefined) {
  const { data: boardServices, isLoading } = useBoardServices(boardId);
  
  return {
    hasBoardServices: !!boardServices && boardServices.length > 0,
    isLoading,
    boardServices,
  };
}

export function useCanCreateWithService(boardId: string | null | undefined, serviceId: string | null | undefined) {
  const { data: boardServicesUsage, isLoading } = useBoardServicesWithUsage(boardId);
  
  if (!boardId || !serviceId || serviceId === "none" || isLoading) {
    return { canCreate: null, isLoading, serviceInfo: null };
  }
  
  // If no board services configured, allow creation (legacy behavior)
  if (!boardServicesUsage || boardServicesUsage.length === 0) {
    return { canCreate: true, isLoading: false, serviceInfo: null };
  }
  
  const serviceInfo = boardServicesUsage.find(bs => bs.service_id === serviceId);
  
  if (!serviceInfo) {
    // Service not configured for this board
    return { canCreate: false, isLoading: false, serviceInfo: null };
  }
  
  return { 
    canCreate: !serviceInfo.isLimitReached, 
    isLoading: false, 
    serviceInfo,
  };
}
