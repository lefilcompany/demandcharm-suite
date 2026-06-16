import { supabase } from "@/integrations/supabase/client";

interface SendPushNotificationParams {
  userIds: string[];
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
  notificationType?: "demandUpdates" | "teamUpdates" | "deadlineReminders" | "adjustmentRequests" | "mentionNotifications";
}

/**
 * Centralized utility to send push notifications via Firebase Cloud Messaging
 * This function calls the send-push-notification Edge Function
 */
export async function sendPushNotification({
  userIds,
  title,
  body,
  link,
  data,
  notificationType,
}: SendPushNotificationParams): Promise<{ success: boolean; sent?: number; failed?: number; error?: string }> {
  if (userIds.length === 0) {
    console.log("No user IDs provided for push notification");
    return { success: true, sent: 0, failed: 0 };
  }

  try {
    const { data: responseData, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userIds,
        title,
        body,
        link,
        data: {
          ...data,
          notificationType: notificationType || "demandUpdates",
        },
      },
    });

    if (error) {
      console.error("Error sending push notification:", error);
      return { success: false, error: error.message };
    }

    console.log("Push notification result:", responseData);
    return {
      success: true,
      sent: responseData?.sent || 0,
      failed: responseData?.failed || 0,
    };
  } catch (error: any) {
    console.error("Error invoking send-push-notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification for adjustment requests
 */
export async function sendAdjustmentPushNotification({
  assigneeIds,
  demandId,
  demandTitle,
  reason,
  isInternal,
  boardName,
}: {
  assigneeIds: string[];
  demandId: string;
  demandTitle: string;
  reason: string;
  isInternal: boolean;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  const title = isInternal ? `🔧 ${boardPrefix}Ajuste interno solicitado` : `📋 ${boardPrefix}Ajuste externo solicitado`;
  const body = isInternal
    ? `Ajuste interno na demanda "${demandTitle.substring(0, 50)}${demandTitle.length > 50 ? "..." : ""}"`
    : `Cliente solicitou ajuste na demanda "${demandTitle.substring(0, 50)}${demandTitle.length > 50 ? "..." : ""}"`;

  return sendPushNotification({
    userIds: assigneeIds,
    title,
    body,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: isInternal ? "internal_adjustment" : "external_adjustment",
      boardName: boardName || "",
    },
    notificationType: "adjustmentRequests",
  });
}

/**
 * Send push notification for adjustment completion
 * Sends to creator + board admins (deduplicated)
 */
export async function sendAdjustmentCompletionPushNotification({
  creatorId,
  adminIds,
  demandId,
  demandTitle,
  boardName,
}: {
  creatorId: string;
  adminIds?: string[];
  demandId: string;
  demandTitle: string;
  boardName?: string;
}) {
  // Deduplicate: creator + admins
  const allIds = new Set([creatorId, ...(adminIds || [])]);
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  return sendPushNotification({
    userIds: Array.from(allIds),
    title: `✅ ${boardPrefix}Ajuste concluído`,
    body: `O ajuste na demanda "${demandTitle.substring(0, 50)}${demandTitle.length > 50 ? "..." : ""}" foi finalizado`,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: "adjustment_completed",
      boardName: boardName || "",
    },
    notificationType: "adjustmentRequests",
  });
}

/**
 * Send push notification for demand assignment
 */
export async function sendAssignmentPushNotification({
  assigneeId,
  demandId,
  demandTitle,
  boardName,
}: {
  assigneeId: string;
  demandId: string;
  demandTitle: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  return sendPushNotification({
    userIds: [assigneeId],
    title: `📌 ${boardPrefix}Você foi atribuído a uma demanda`,
    body: `Você foi designado para trabalhar na demanda "${demandTitle.substring(0, 50)}${demandTitle.length > 50 ? "..." : ""}"`,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: "demand_assigned",
      boardName: boardName || "",
    },
    notificationType: "demandUpdates",
  });
}

/**
 * Send push notification for status changes
 */
export async function sendStatusChangePushNotification({
  userIds,
  demandId,
  demandTitle,
  oldStatus,
  newStatus,
  boardName,
}: {
  userIds: string[];
  demandId: string;
  demandTitle: string;
  oldStatus: string;
  newStatus: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  const isDelivered = newStatus === "Entregue";
  const title = isDelivered ? `🎉 ${boardPrefix}Demanda entregue!` : `📊 ${boardPrefix}Status atualizado`;
  const body = `"${demandTitle.substring(0, 40)}${demandTitle.length > 40 ? "..." : ""}" mudou para "${newStatus}"`;

  return sendPushNotification({
    userIds,
    title,
    body,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: "status_changed",
      oldStatus,
      newStatus,
      boardName: boardName || "",
    },
    notificationType: "demandUpdates",
  });
}

/**
 * Send push notification for deadline reminders
 */
export async function sendDeadlinePushNotification({
  userIds,
  demandId,
  demandTitle,
  hoursRemaining,
  isOverdue,
  boardName,
}: {
  userIds: string[];
  demandId: string;
  demandTitle: string;
  hoursRemaining: number;
  isOverdue: boolean;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  const title = isOverdue
    ? `🚨 ${boardPrefix}Prazo vencido!`
    : hoursRemaining <= 2
      ? `⚠️ ${boardPrefix}Prazo urgente!`
      : `⏰ ${boardPrefix}Prazo se aproximando`;

  const body = isOverdue
    ? `A demanda "${demandTitle.substring(0, 40)}..." está com prazo vencido!`
    : `A demanda "${demandTitle.substring(0, 40)}..." vence em ${hoursRemaining}h`;

  return sendPushNotification({
    userIds,
    title,
    body,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: isOverdue ? "deadline_overdue" : "deadline_approaching",
      hoursRemaining: String(hoursRemaining),
      boardName: boardName || "",
    },
    notificationType: "deadlineReminders",
  });
}

/**
 * Send push notification for new demand creation
 */
export async function sendNewDemandPushNotification({
  teamMemberIds,
  demandId,
  demandTitle,
  creatorName,
  boardName,
}: {
  teamMemberIds: string[];
  demandId: string;
  demandTitle: string;
  creatorName: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  return sendPushNotification({
    userIds: teamMemberIds,
    title: `📝 ${boardPrefix}Nova demanda criada`,
    body: `${creatorName} criou "${demandTitle.substring(0, 50)}${demandTitle.length > 50 ? "..." : ""}"`,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: "new_demand",
      boardName: boardName || "",
    },
    notificationType: "demandUpdates",
  });
}

/**
 * Send push notification for mentions
 */
export async function sendMentionPushNotification({
  mentionedUserId,
  demandId,
  demandTitle,
  mentionerName,
  boardName,
}: {
  mentionedUserId: string;
  demandId: string;
  demandTitle: string;
  mentionerName: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  return sendPushNotification({
    userIds: [mentionedUserId],
    title: `💬 ${boardPrefix}Você foi mencionado`,
    body: `${mentionerName} mencionou você na demanda "${demandTitle.substring(0, 40)}${demandTitle.length > 40 ? "..." : ""}"`,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: "mention",
      boardName: boardName || "",
    },
    notificationType: "mentionNotifications",
  });
}

/**
 * Send push notification for new comment
 */
export async function sendCommentPushNotification({
  userIds,
  demandId,
  demandTitle,
  commenterName,
  commentPreview,
  boardName,
}: {
  userIds: string[];
  demandId: string;
  demandTitle: string;
  commenterName: string;
  commentPreview: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  return sendPushNotification({
    userIds,
    title: `💬 ${boardPrefix}Novo comentário`,
    body: `${commenterName} comentou em "${demandTitle.substring(0, 30)}...": ${commentPreview.substring(0, 50)}${commentPreview.length > 50 ? "..." : ""}`,
    link: `/demands/${demandId}`,
    data: {
      demandId,
      type: "new_comment",
      boardName: boardName || "",
    },
    notificationType: "demandUpdates",
  });
}

/**
 * Send push notification for team join request
 */
export async function sendTeamJoinRequestPushNotification({
  adminIds,
  requesterName,
  teamName,
}: {
  adminIds: string[];
  requesterName: string;
  teamName: string;
}) {
  return sendPushNotification({
    userIds: adminIds,
    title: "👤 Nova solicitação de entrada",
    body: `${requesterName} solicitou entrada na equipe "${teamName}"`,
    link: "/teams/requests",
    data: {
      type: "team_join_request",
    },
    notificationType: "teamUpdates",
  });
}

/**
 * Send push notification for demand request (from requester)
 */
export async function sendDemandRequestPushNotification({
  adminIds,
  requesterName,
  requestTitle,
  boardName,
}: {
  adminIds: string[];
  requesterName: string;
  requestTitle: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  return sendPushNotification({
    userIds: adminIds,
    title: `📋 ${boardPrefix}Nova solicitação de demanda`,
    body: `${requesterName} solicitou: "${requestTitle.substring(0, 50)}${requestTitle.length > 50 ? "..." : ""}"`,
    link: "/demand-requests",
    data: {
      type: "demand_request",
      boardName: boardName || "",
    },
    notificationType: "demandUpdates",
  });
}

/**
 * Send push notification for demand request status change
 */
export async function sendDemandRequestStatusPushNotification({
  requesterId,
  requestTitle,
  status,
  responderName,
  boardName,
}: {
  requesterId: string;
  requestTitle: string;
  status: "approved" | "rejected" | "returned";
  responderName: string;
  boardName?: string;
}) {
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  const statusConfig = {
    approved: {
      title: `✅ ${boardPrefix}Solicitação aprovada!`,
      body: `Sua solicitação "${requestTitle.substring(0, 40)}..." foi aprovada por ${responderName}`,
      link: "/demands",
    },
    rejected: {
      title: `❌ ${boardPrefix}Solicitação rejeitada`,
      body: `Sua solicitação "${requestTitle.substring(0, 40)}..." foi rejeitada`,
      link: "/my-requests",
    },
    returned: {
      title: `↩️ ${boardPrefix}Solicitação devolvida`,
      body: `Sua solicitação "${requestTitle.substring(0, 40)}..." foi devolvida para revisão`,
      link: "/my-requests",
    },
  };

  const config = statusConfig[status];

  return sendPushNotification({
    userIds: [requesterId],
    title: config.title,
    body: config.body,
    link: config.link,
    data: {
      type: `demand_request_${status}`,
      boardName: boardName || "",
    },
    notificationType: "demandUpdates",
  });
}
