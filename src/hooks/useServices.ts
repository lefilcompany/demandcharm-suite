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
        .eq("is_active", true)
        .order("sort_order")
        .order("name");

      // Filter by board_id: show services for this board OR team-wide services (board_id = null)
      if (boardId) {
        query = query.or(`board_id.eq.${boardId},board_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as Service[];
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
