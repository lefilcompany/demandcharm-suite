import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/hooks/usePlans";

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Omit<Plan, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("plans")
        .insert(plan as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Plan> & { id: string }) => {
      const { error } = await supabase
        .from("plans")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useReorderPlans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plans: { id: string; sort_order: number }[]) => {
      // Update each plan's sort_order
      for (const p of plans) {
        const { error } = await supabase
          .from("plans")
          .update({ sort_order: p.sort_order } as any)
          .eq("id", p.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
