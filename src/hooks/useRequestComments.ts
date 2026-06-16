import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export function useRequestComments(requestId: string | null) {
  return useQuery({
    queryKey: ["request-comments", requestId],
    queryFn: async () => {
      if (!requestId) return [];
      
      const { data, error } = await supabase
        .from("demand_request_comments")
        .select(`*`)
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(comment => ({
        ...comment,
        profiles: profileMap.get(comment.user_id) || { full_name: "Usuário", avatar_url: null }
      })) as RequestComment[];
    },
    enabled: !!requestId,
  });
}

export function useCreateRequestComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("demand_request_comments")
        .insert({
          request_id: requestId,
          user_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["request-comments", variables.requestId] });
    },
  });
}

export function useUpdateRequestComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, content, requestId }: { commentId: string; content: string; requestId: string }) => {
      const { data, error } = await supabase
        .from("demand_request_comments")
        .update({ content })
        .eq("id", commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["request-comments", variables.requestId] });
    },
  });
}

export function useDeleteRequestComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, requestId }: { commentId: string; requestId: string }) => {
      const { error } = await supabase
        .from("demand_request_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["request-comments", variables.requestId] });
    },
  });
}
