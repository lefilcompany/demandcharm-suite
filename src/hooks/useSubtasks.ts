import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SubtaskCreateSchema, SubtaskUpdateSchema, validateData } from "@/lib/validations";

interface Subtask {
  id: string;
  demand_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export function useSubtasks(demandId: string | null) {
  return useQuery({
    queryKey: ["subtasks", demandId],
    queryFn: async () => {
      if (!demandId) return [];
      const { data, error } = await supabase
        .from("demand_subtasks")
        .select("*")
        .eq("demand_id", demandId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Subtask[];
    },
    enabled: !!demandId,
  });
}

export function useCreateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, title }: { demandId: string; title: string }) => {
      // Validate input data before database operation
      const validatedData = validateData(SubtaskCreateSchema, { demandId, title });
      
      const { data: existing } = await supabase
        .from("demand_subtasks")
        .select("sort_order")
        .eq("demand_id", validatedData.demandId)
        .order("sort_order", { ascending: false })
        .limit(1);
      
      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
      
      const { data, error } = await supabase
        .from("demand_subtasks")
        .insert({ demand_id: validatedData.demandId, title: validatedData.title, sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", variables.demandId] });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed, title }: { id: string; completed?: boolean; title?: string }) => {
      // Validate input data before database operation
      const validatedData = validateData(SubtaskUpdateSchema, { id, completed, title });
      
      const updates: Partial<Subtask> = {};
      if (validatedData.completed !== undefined) updates.completed = validatedData.completed;
      if (validatedData.title !== undefined) updates.title = validatedData.title;
      
      const { data, error } = await supabase
        .from("demand_subtasks")
        .update(updates)
        .eq("id", validatedData.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", data.demand_id] });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, demandId }: { id: string; demandId: string }) => {
      const { error } = await supabase
        .from("demand_subtasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { demandId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", data.demandId] });
    },
  });
}
