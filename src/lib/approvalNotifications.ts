import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/hooks/useSendPushNotification";
import { buildPublicDemandUrl } from "@/lib/demandShareUtils";

export type ApprovalKind = "internal" | "external";

export interface ApprovalNotifyParams {
  demandId: string;
  demandTitle: string;
  boardName?: string;
  approvalType: ApprovalKind;
  recipientIds: string[];
  senderId: string;
}

const buildTitle = (kind: ApprovalKind, boardName?: string) => {
  const prefix = boardName ? `[${boardName}] ` : "";
  return kind === "internal"
    ? `🔵 ${prefix}Aprovação interna pendente`
    : `🟠 ${prefix}Aprovação do cliente pendente`;
};

const buildMessage = (kind: ApprovalKind, demandTitle: string) =>
  kind === "internal"
    ? `A demanda "${demandTitle}" aguarda aprovação interna.`
    : `A demanda "${demandTitle}" aguarda aprovação do cliente.`;

/**
 * Sends in-app notifications, push notifications and emails for an approval request.
 * Recipient list is deduplicated and the sender is removed automatically.
 */
export async function notifyApproval({
  demandId,
  demandTitle,
  boardName,
  approvalType,
  recipientIds,
  senderId,
}: ApprovalNotifyParams): Promise<{ sent: number }> {
  const recipients = Array.from(new Set(recipientIds.filter(Boolean))).filter(
    (id) => id !== senderId,
  );

  if (recipients.length === 0) return { sent: 0 };

  const title = buildTitle(approvalType, boardName);
  const message = buildMessage(approvalType, demandTitle);
  const link = `/demands/${demandId}`;

  // 1) In-app notifications via SECURITY DEFINER RPC (bypasses cross-user RLS)
  try {
    const { error: rpcError } = await supabase.rpc("create_approval_notifications", {
      p_demand_id: demandId,
      p_recipient_ids: recipients,
      p_title: title,
      p_message: message,
      p_link: link,
      p_type: "info",
    });
    if (rpcError) {
      console.error("Error inserting approval notifications (RPC):", rpcError);
    }
  } catch (error) {
    console.error("Error inserting approval notifications:", error);
  }

  // 2) Push notifications
  try {
    await sendPushNotification({
      userIds: recipients,
      title,
      body: message,
      link,
      data: {
        demandId,
        type: approvalType === "internal" ? "internal_approval" : "external_approval",
        boardName: boardName || "",
      },
      notificationType: "demandUpdates",
    });
  } catch (error) {
    console.error("Error sending approval push:", error);
  }

  // 3) Emails (with public link)
  try {
    const publicUrl = await buildPublicDemandUrl(demandId, senderId);
    const subject =
      (boardName ? `[${boardName}] ` : "") +
      (approvalType === "internal"
        ? `Aprovação interna pendente: ${demandTitle}`
        : `Aprovação do cliente pendente: ${demandTitle}`);

    await Promise.all(
      recipients.map(async (userId) => {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();

          await supabase.functions.invoke("send-email", {
            body: {
              to: userId,
              subject,
              template: "notification",
              templateData: {
                title,
                message,
                actionUrl: publicUrl,
                actionText: "Revisar demanda",
                userName: profile?.full_name || "Usuário",
                type: "info" as const,
              },
            },
          });
        } catch (emailError) {
          console.error("Error sending approval email:", emailError);
        }
      }),
    );
  } catch (error) {
    console.error("Error sending approval emails:", error);
  }

  return { sent: recipients.length };
}

export const APPROVAL_STATUS_NAMES: Record<ApprovalKind, string> = {
  internal: "Aprovação Interna",
  external: "Aprovação do Cliente",
};

export function approvalKindFromStatusName(name?: string | null): ApprovalKind | null {
  if (!name) return null;
  if (name === "Aprovação Interna") return "internal";
  if (name === "Aprovação do Cliente") return "external";
  return null;
}
