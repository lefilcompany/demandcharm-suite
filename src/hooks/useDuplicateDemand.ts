import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showPlanLimitToast } from "@/lib/planLimitErrors";
import { usePlansModal } from "@/contexts/PlansModalContext";

export interface DuplicateDemandInput {
  demandId: string;
  /** New due date for the parent (ISO) — when the original is overdue */
  newDueDate?: string | null;
  /** Map of original subdemand id -> new ISO due date */
  subdemandDueDates?: Record<string, string>;
  copyAttachments?: boolean;
}

export interface DuplicateDemandResult {
  newDemandId: string;
  idMap: Record<string, string>;
  attachmentsCopied: number;
  attachmentsFailed: number;
}

async function copyAttachments(idMap: Record<string, string>): Promise<{ copied: number; failed: number }> {
  const sourceIds = Object.keys(idMap);
  let copied = 0;
  let failed = 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { copied, failed };

  const { data: rows, error } = await supabase
    .from("demand_attachments")
    .select("demand_id, file_name, file_path, file_type, file_size")
    .in("demand_id", sourceIds)
    .is("interaction_id", null);

  if (error || !rows?.length) return { copied, failed };

  for (const row of rows) {
    try {
      const { data: blob, error: dlError } = await supabase.storage
        .from("demand-attachments")
        .download(row.file_path);
      if (dlError || !blob) throw dlError ?? new Error("download failed");

      const targetDemandId = idMap[row.demand_id];
      const ext = row.file_name.split(".").pop() || "bin";
      const newPath = `${user.id}/${targetDemandId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upError } = await supabase.storage
        .from("demand-attachments")
        .upload(newPath, blob, { cacheControl: "3600", upsert: false, contentType: row.file_type });
      if (upError) throw upError;

      const { error: insError } = await supabase.from("demand_attachments").insert({
        demand_id: targetDemandId,
        file_name: row.file_name,
        file_path: newPath,
        file_type: row.file_type,
        file_size: row.file_size,
        uploaded_by: user.id,
      });
      if (insError) throw insError;

      copied++;
    } catch (e) {
      console.error("[duplicate-demand] attachment copy failed", row.file_path, e);
      failed++;
    }
  }

  return { copied, failed };
}

export function useDuplicateDemand() {
  const queryClient = useQueryClient();
  const { openPlans } = usePlansModal();

  return useMutation<DuplicateDemandResult, Error, DuplicateDemandInput>({
    mutationFn: async ({ demandId, newDueDate, subdemandDueDates, copyAttachments: withAttachments }) => {
      const { data, error } = await supabase.rpc("duplicate_demand", {
        p_demand_id: demandId,
        p_new_due_date: newDueDate ?? null,
        p_subdemand_due_dates: (subdemandDueDates ?? {}) as never,
      });

      if (error) throw error;

      const result = data as unknown as { new_demand_id: string; id_map: Record<string, string> };
      let attachmentsCopied = 0;
      let attachmentsFailed = 0;

      if (withAttachments) {
        const res = await copyAttachments(result.id_map);
        attachmentsCopied = res.copied;
        attachmentsFailed = res.failed;
      }

      return {
        newDemandId: result.new_demand_id,
        idMap: result.id_map,
        attachmentsCopied,
        attachmentsFailed,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["subdemands"] });
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
      queryClient.invalidateQueries({ queryKey: ["all-team-demands"] });
    },
    onError: (error: Error) => {
      if (showPlanLimitToast(error, openPlans)) return;
    },
  });
}
