import { supabase } from "@/integrations/supabase/client";
import { notifyApproval, type ApprovalKind } from "@/lib/approvalNotifications";

/**
 * Tries to auto-send approval notifications using the per-demand saved setting
 * (created at demand creation via ApprovalNotificationsModal).
 *
 * Returns:
 *  - { handled: true } when a per-demand setting was found and notifications were dispatched
 *    (in-app + push + email), so the caller should NOT open the manual dialog.
 *  - { handled: false } when no per-demand setting exists, the caller should fall back
 *    to opening the manual ApprovalNotifyDialog (which will pre-select the board default
 *    or "all eligible").
 */
export async function tryAutoNotifyApprovalFromSavedSetting(params: {
  demandId: string;
  demandTitle: string;
  demandCreatedBy?: string | null;
  boardId: string;
  boardName?: string;
  approvalType: ApprovalKind;
  senderId: string;
}): Promise<{ handled: boolean; sent?: number }> {
  const {
    demandId,
    demandTitle,
    demandCreatedBy,
    boardId,
    boardName,
    approvalType,
    senderId,
  } = params;

  try {
    const { data, error } = await supabase
      .from("demand_approval_notify_settings" as any)
      .select("mode, recipient_ids, include_creator")
      .eq("demand_id", demandId)
      .eq("approval_type", approvalType)
      .maybeSingle();

    if (error || !data) return { handled: false };

    const setting = data as unknown as {
      mode: "all" | "manual";
      recipient_ids: string[] | null;
      include_creator: boolean;
    };

    let recipients: string[] = [];

    if (setting.mode === "manual") {
      recipients = [...(setting.recipient_ids ?? [])];
    } else {
      // "all" — resolve eligible board members by role
      const allowedRoles =
        approvalType === "internal" ? ["admin", "moderator"] : ["requester"];
      const { data: members } = await supabase
        .from("board_members")
        .select("user_id, role")
        .eq("board_id", boardId)
        .in("role", allowedRoles as any);
      recipients = (members ?? []).map((m: any) => m.user_id);
    }

    if (setting.include_creator && demandCreatedBy && demandCreatedBy !== senderId) {
      if (!recipients.includes(demandCreatedBy)) recipients.push(demandCreatedBy);
    }

    // Dedupe + remove sender
    recipients = Array.from(new Set(recipients.filter((id) => id && id !== senderId)));

    if (recipients.length === 0) {
      // Setting exists but resolved to empty → still consider it handled
      // (user explicitly chose to suppress notifications by saving an empty list).
      return { handled: true, sent: 0 };
    }

    const { sent } = await notifyApproval({
      demandId,
      demandTitle,
      boardName,
      approvalType,
      recipientIds: recipients,
      senderId,
    });
    return { handled: true, sent };
  } catch (err) {
    console.error("tryAutoNotifyApprovalFromSavedSetting failed:", err);
    return { handled: false };
  }
}
