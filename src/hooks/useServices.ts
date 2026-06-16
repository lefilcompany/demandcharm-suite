import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ServiceCreateSchema, ServiceUpdateSchema, validateData } from "@/lib/validations";
import { useMemo } from "react";
import { toast } from "sonner";
import { usePlansModal } from "@/contexts/PlansModalContext";
import { showPlanLimitToast } from "@/lib/planLimitErrors";

export interface Service {
  id: string;
  name: string;
  description: string | null;
  estimated_hours: number;
  price_cents: number;
  team_id: string;
  board_id: string | null;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceWithHierarchy extends Service {
  children: ServiceWithHierarchy[];
  isCategory: boolean;
  parentName?: string;
}

export interface SelectableService extends Service {
  categoryName?: string;
  displayName: string;
}

export function useServices(teamId: string | null, boardId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["services", teamId, boardId],
    queryFn: async () => {
      if (!teamId) return [];
      
      let query = supabase
        .from("services")
        .select("*")
        .eq("team_id", teamId)
        .order("name");

      // Filter by board_id: show services for this board OR team-wide services (board_id = null)
      if (boardId) {
        query = query.or(`board_id.eq.${boardId},board_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!user && !!teamId,
  });
}

// Hook to get hierarchical services with parent-child relationships
export function useHierarchicalServices(teamId: string | null, boardId?: string | null) {
  const { data: services, isLoading, error } = useServices(teamId, boardId);

  const hierarchicalServices = useMemo(() => {
    if (!services) return [];

    // Get root services (no parent)
    const rootServices = services.filter(s => !s.parent_id);
    
    // Build hierarchy
    const buildHierarchy = (parentId: string | null): ServiceWithHierarchy[] => {
      const children = services.filter(s => s.parent_id === parentId);
      
      return children.map(service => {
        const grandchildren = services.filter(s => s.parent_id === service.id);
        const isCategory = grandchildren.length > 0;
        
        return {
          ...service,
          children: isCategory ? buildHierarchy(service.id) : [],
          isCategory,
        };
      });
    };

    return rootServices.map(service => {
      const children = services.filter(s => s.parent_id === service.id);
      const isCategory = children.length > 0;
      
      return {
        ...service,
        children: isCategory ? buildHierarchy(service.id) : [],
        isCategory,
      } as ServiceWithHierarchy;
    });
  }, [services]);

  return { data: hierarchicalServices, isLoading, error, rawServices: services };
}

// Hook to get only selectable services (subservices + root services without children)
export function useSelectableServices(teamId: string | null, boardId?: string | null) {
  const { data: hierarchicalServices, isLoading, error, rawServices } = useHierarchicalServices(teamId, boardId);

  const selectableServices = useMemo(() => {
    if (!hierarchicalServices) return [];

    const selectable: SelectableService[] = [];

    const processService = (service: ServiceWithHierarchy, categoryName?: string) => {
      if (service.isCategory) {
        // It's a category - process its children
        service.children.forEach(child => {
          processService(child, service.name);
        });
      } else {
        // It's a selectable service (leaf node or root without children)
        selectable.push({
          ...service,
          categoryName,
          displayName: categoryName ? `${categoryName} > ${service.name}` : service.name,
        });
      }
    };

    hierarchicalServices.forEach(service => processService(service));

    return selectable;
  }, [hierarchicalServices]);

  return { data: selectableServices, isLoading, error, rawServices };
}

// Hook to get services that can be parent categories (root services or services that are already categories)
export function usePotentialParentServices(teamId: string | null, excludeId?: string) {
  const { data: services, isLoading } = useServices(teamId);

  const potentialParents = useMemo(() => {
    if (!services) return [];

    // Get services that have no parent (root level) and exclude the current service if editing
    return services.filter(s => !s.parent_id && s.id !== excludeId);
  }, [services, excludeId]);

  return { data: potentialParents, isLoading };
}

export function useCreateService() {
  const queryClient = useQueryClient();
  const { openPlans } = usePlansModal();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      team_id: string;
      estimated_hours: number;
      price_cents?: number;
      parent_id?: string | null;
    }) => {
      // Validate input data before database operation
      const validatedData = validateData(ServiceCreateSchema, data);
      const userId = (await supabase.auth.getUser()).data.user!.id;
      
      const { data: service, error } = await supabase
        .from("services")
        .insert({
          name: validatedData.name,
          description: validatedData.description,
          team_id: validatedData.team_id,
          estimated_hours: validatedData.estimated_hours,
          price_cents: validatedData.price_cents || 0,
          parent_id: data.parent_id || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return service;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["services", variables.team_id] });
    },
    onError: (error: Error) => {
      if (showPlanLimitToast(error, openPlans)) return;
      toast.error("Erro ao criar serviço: " + error.message);
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      team_id,
      ...data
    }: {
      id: string;
      team_id: string;
      name?: string;
      description?: string;
      estimated_hours?: number;
      price_cents?: number;
      parent_id?: string | null;
    }) => {
      // Validate input data before database operation
      const validatedData = validateData(ServiceUpdateSchema, { id, team_id, ...data });
      const { id: validatedId, team_id: validatedTeamId, ...updateData } = validatedData;
      
      // Add parent_id if provided
      const finalUpdateData = {
        ...updateData,
        ...(data.parent_id !== undefined ? { parent_id: data.parent_id } : {}),
      };
      
      const { data: service, error } = await supabase
        .from("services")
        .update(finalUpdateData)
        .eq("id", validatedId)
        .select()
        .single();

      if (error) throw error;
      return service;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["services", variables.team_id] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, team_id }: { id: string; team_id: string }) => {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["services", variables.team_id] });
    },
  });
}

// Helper to get service name with category prefix
export function getServiceDisplayName(service: Service, allServices: Service[]): string {
  if (!service.parent_id) return service.name;
  
  const parent = allServices.find(s => s.id === service.parent_id);
  if (!parent) return service.name;
  
  return `${parent.name} > ${service.name}`;
}
