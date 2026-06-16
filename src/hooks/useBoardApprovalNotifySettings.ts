import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { ApprovalKind } from "@/lib/approvalNotifications";

export interface BoardApprovalNotifySetting {
  id: string;
  board_id: string;
  approval_type: ApprovalKind;
  recipient_ids: string[];
  include_creator: boolean;
  mode: "all" | "manual";
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useBoardApprovalNotifySettings(boardId: string | null | undefined) {
  return useQuery({
    queryKey: ["board-approval-notify-settings", boardId],
    queryFn: async (): Promise<BoardApprovalNotifySetting[]> => {
      if (!boardId) return [];
      const { data, error } = await supabase
        .from("board_approval_notify_settings" as any)
        .select("*")
        .eq("board_id", boardId);
      if (error) {
        console.error("Error fetching board approval notify settings", error);
        return [];
      }
      return (data ?? []) as unknown as BoardApprovalNotifySetting[];
    },
    enabled: !!boardId,
    staleTime: 60_000,
  });
}

export function useBoardApprovalNotifySetting(
  boardId: string | null | undefined,
  approvalType: ApprovalKind,
) {
  const { data: settings, ...rest } = useBoardApprovalNotifySettings(boardId);
  const setting = settings?.find((s) => s.approval_type === approvalType);
  return { setting, ...rest };
}

export interface DemandApprovalNotifySetting {
  id: string;
  demand_id: string;
  approval_type: ApprovalKind;
  recipient_ids: string[];
  include_creator: boolean;
  mode: "all" | "manual";
}

export function useDemandApprovalNotifySetting(
  demandId: string | null | undefined,
  approvalType: ApprovalKind,
) {
  return useQuery({
    queryKey: ["demand-approval-notify-setting", demandId, approvalType],
    queryFn: async (): Promise<DemandApprovalNotifySetting | null> => {
      if (!demandId) return null;
      const { data, error } = await supabase
        .from("demand_approval_notify_settings" as any)
        .select("*")
        .eq("demand_id", demandId)
        .eq("approval_type", approvalType)
        .maybeSingle();
      if (error) {
        console.error("Error fetching demand approval notify setting", error);
        return null;
      }
      return (data ?? null) as unknown as DemandApprovalNotifySetting | null;
    },
    enabled: !!demandId,
    staleTime: 30_000,
  });
}

export interface UpsertBoardApprovalNotifyInput {
  boardId: string;
  approvalType: ApprovalKind;
  recipientIds: string[];
  includeCreator: boolean;
  mode: "all" | "manual";
}

export function useUpsertBoardApprovalNotifySetting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpsertBoardApprovalNotifyInput) => {
      if (!user?.id) throw new Error("Não autenticado");

      const { data: existing } = (await supabase
        .from("board_approval_notify_settings" as any)
        .select("id")
        .eq("board_id", input.boardId)
        .eq("approval_type", input.approvalType)
        .maybeSingle()) as { data: { id: string } | null };

      const payload = {
        board_id: input.boardId,
        approval_type: input.approvalType,
        recipient_ids: input.recipientIds,
        include_creator: input.includeCreator,
        mode: input.mode,
        updated_by: user.id,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("board_approval_notify_settings" as any)
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("board_approval_notify_settings" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["board-approval-notify-settings", vars.boardId],
      });
    },
  });
}
