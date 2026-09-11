import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";

export interface Service {
  id: string;
  name: string;
  description: string | null;
  estimated_hours: number;
  price_cents: number;
  team_id: string;
  board_id: string | null;
  parent_id: string | null;
  is_folder: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_catalog?: boolean;
  is_active?: boolean;
  hours_min?: number | null;
  hours_max?: number | null;
  hours_unit?: string | null;
  sort_order?: number;
  catalog_key?: string | null;
  behavior?: "standard" | "meeting";
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

/** Formats the reference hours of a catalog service, e.g. "0,5–2h/dia". */
export function formatServiceHours(service: Pick<Service, "estimated_hours" | "hours_min" | "hours_max" | "hours_unit">): string {
  const fmt = (n: number) => String(n).replace(".", ",");
  const unitSuffix =
    service.hours_unit === "semana" ? "/semana" : service.hours_unit === "dia" ? "/dia" : "";

  if (service.hours_min != null && service.hours_max != null) {
    return service.hours_min === service.hours_max
      ? `${fmt(Number(service.hours_min))}h${unitSuffix}`
      : `${fmt(Number(service.hours_min))}–${fmt(Number(service.hours_max))}h${unitSuffix}`;
  }
  return `${service.estimated_hours}h`;
}

interface UseServicesOptions {
  includeInactive?: boolean;
  includeServiceId?: string | null;
}

export function useServices(teamId: string | null, boardId?: string | null, options: UseServicesOptions = {}) {
  const { user } = useAuth();
  const { includeInactive = false, includeServiceId = null } = options;

  return useQuery({
    queryKey: ["services", teamId, boardId, includeInactive, includeServiceId],
    queryFn: async () => {
      if (!teamId) return [];

      let query = supabase
        .from("services")
        .select("*")
        .eq("team_id", teamId)
        .order("sort_order")
        .order("name");

      if (!includeInactive && !includeServiceId) {
        query = query.eq("is_active", true);
      }

      // When a current legacy service is requested, filtering is completed below
      // so that its existing value remains visible even if it left the board scope.
      if (boardId && !includeServiceId) {
        query = query.or(`board_id.eq.${boardId},board_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      const services = (data || []) as unknown as Service[];
      return services.filter((service) => {
        if (service.id === includeServiceId) return true;
        const isInBoardScope = !boardId || service.board_id === boardId || service.board_id === null;
        return isInBoardScope && (includeInactive || service.is_active !== false);
      });
    },
    enabled: !!user && !!teamId,
  });
}

// Hook to get hierarchical services with parent-child relationships
export function useHierarchicalServices(teamId: string | null, boardId?: string | null, options: UseServicesOptions = {}) {
  const { data: services, isLoading, error } = useServices(teamId, boardId, options);

  const hierarchicalServices = useMemo(() => {
    if (!services) return [];

    // Get root services (no parent)
    const rootServices = services.filter(s => !s.parent_id);

    // Build hierarchy
    const buildHierarchy = (parentId: string | null): ServiceWithHierarchy[] => {
      const children = services.filter(s => s.parent_id === parentId);

      return children.map(service => {
        const grandchildren = services.filter(s => s.parent_id === service.id);
        const isCategory = !!service.is_folder || grandchildren.length > 0;

        return {
          ...service,
          children: isCategory ? buildHierarchy(service.id) : [],
          isCategory,
        };
      });
    };

    return rootServices.map(service => {
      const children = services.filter(s => s.parent_id === service.id);
      const isCategory = !!service.is_folder || children.length > 0;

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

// Helper to get service name with category prefix
export function getServiceDisplayName(service: Service, allServices: Service[]): string {
  if (!service.parent_id) return service.name;

  const parent = allServices.find(s => s.id === service.parent_id);
  if (!parent) return service.name;

  return `${parent.name} > ${service.name}`;
}
