import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Attachment {
  id: string;
  demand_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export function useAttachments(demandId: string | null) {
  return useQuery({
    queryKey: ["attachments", demandId],
    queryFn: async () => {
      if (!demandId) return [];
      const { data, error } = await supabase
        .from("demand_attachments")
        .select("*, profiles(full_name, avatar_url)")
        .eq("demand_id", demandId)
        .is("interaction_id", null) // Only general attachments, not interaction attachments
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!demandId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, file, interactionId }: { demandId: string; file: File; interactionId?: string }) => {
      // Use current session user (not stale closure) to guarantee auth alignment with RLS
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Sessão expirada. Faça login novamente para enviar anexos.");
      }

      const fileExt = file.name.split(".").pop() || "bin";
      const filePath = `${user.id}/${demandId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("demand-attachments")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        console.error("[attachments] storage upload failed", { filePath, uploadError });
        throw uploadError;
      }

      const insertData: {
        demand_id: string;
        file_name: string;
        file_path: string;
        file_type: string;
        file_size: number;
        uploaded_by: string;
        interaction_id?: string;
      } = {
        demand_id: demandId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: user.id,
      };

      if (interactionId) {
        insertData.interaction_id = interactionId;
      }

      const { data, error } = await supabase
        .from("demand_attachments")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // Rollback: remove orphan file from storage since the DB insert failed
        console.error("[attachments] DB insert failed, removing orphan storage object", { filePath, error });
        await supabase.storage.from("demand-attachments").remove([filePath]).catch((e) => {
          console.error("[attachments] failed to clean up orphan storage object", e);
        });
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attachments", variables.demandId] });
      if (variables.interactionId) {
        queryClient.invalidateQueries({ queryKey: ["interaction-attachments", variables.interactionId] });
      }
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath, demandId }: { id: string; filePath: string; demandId: string }) => {
      await supabase.storage.from("demand-attachments").remove([filePath]);
      
      const { error } = await supabase
        .from("demand_attachments")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return { demandId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["attachments", data.demandId] });
    },
  });
}

export async function getAttachmentUrl(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("demand-attachment-url", {
      body: { filePath },
    });

    if (!error && data?.signedUrl) {
      return data.signedUrl as string;
    }

    // If file not found (deleted), return null silently
    if (data?.code === "FILE_NOT_FOUND" || data?.code === "ATTACHMENT_NOT_FOUND") {
      return null;
    }

    if (error && "context" in error) {
      try {
        const response = error.context as Response;
        const errorBody = await response.json().catch(() => null);
        if (errorBody?.code === "FILE_NOT_FOUND" || errorBody?.code === "ATTACHMENT_NOT_FOUND") {
          return null;
        }
      } catch {
        // ignore response parsing failures and continue to fallback
      }
    }

    console.error("Edge function error:", error || data);
  } catch (e) {
    console.error("Failed to get attachment URL:", e);
  }

  // Fallback to direct signed URL
  const { data: fallbackData, error: fallbackError } = await supabase.storage
    .from("demand-attachments")
    .createSignedUrl(filePath, 14400);

  if (fallbackError) {
    // File doesn't exist in storage — suppress noisy logs for known missing files
    if (fallbackError.message?.includes("not found")) return null;
    console.error("Fallback signed URL error:", fallbackError);
    return null;
  }

  return fallbackData.signedUrl;
}

// Synchronous version for immediate use (creates signed URL in background)
export function useAttachmentUrl(filePath: string | null) {
  return useQuery({
    queryKey: ["attachment-url", filePath],
    queryFn: async () => {
      if (!filePath) return null;
      return getAttachmentUrl(filePath);
    },
    enabled: !!filePath,
    staleTime: 1000 * 60 * 60 * 3,
  });
}
