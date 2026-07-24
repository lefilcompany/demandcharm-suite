import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/hooks/useSendPushNotification";

export type DemandAssigneeEvent =
  | "assigned_primary"
  | "assigned_follower"
  | "promoted_primary"
  | "unassigned";

interface NotifyDemandAssigneeChangeParams {
  event: DemandAssigneeEvent;
  /** Usuário destinatário (afetado pela mudança). */
  userId: string;
  /** Demanda alvo. */
  demandId: string;
  /** Título da demanda. */
  demandTitle: string;
  /** Nome do quadro (opcional, entra no prefixo `[Quadro]`). */
  boardName?: string;
  /** Quem realizou a ação. */
  actorId: string;
  /** Nome de quem realizou a ação. */
  actorName: string;
}

function buildAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://pla.soma.lefil.com.br";
}

interface BuiltMessages {
  inAppTitle: string;
  inAppMessage: string;
  inAppType: "info" | "success" | "warning" | "error";
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  emailMessage: string;
  link: string;
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.substring(0, max)}…` : value;
}

function buildMessages(params: NotifyDemandAssigneeChangeParams): BuiltMessages {
  const { event, demandId, demandTitle, boardName, actorName } = params;
  const boardPrefix = boardName ? `[${boardName}] ` : "";
  const link = `/demands/${demandId}`;
  const shortTitle = truncate(demandTitle, 50);

  switch (event) {
    case "assigned_primary":
      return {
        inAppTitle: "Você é o responsável por uma demanda",
        inAppMessage: `${actorName} definiu você como responsável principal da demanda "${demandTitle}".`,
        inAppType: "info",
        pushTitle: `📌 ${boardPrefix}Você é o responsável por uma demanda`,
        pushBody: `${actorName} definiu você como responsável de "${shortTitle}"`,
        emailSubject: `📌 ${boardPrefix}Você é o responsável por "${demandTitle}"`,
        emailMessage: `${actorName} definiu você como responsável principal da demanda "${demandTitle}". Você já pode acessar e executar a demanda.`,
        link,
      };
    case "assigned_follower":
      return {
        inAppTitle: "Você foi adicionado como seguidor",
        inAppMessage: `${actorName} adicionou você como seguidor da demanda "${demandTitle}".`,
        inAppType: "info",
        pushTitle: `👥 ${boardPrefix}Você é seguidor de uma demanda`,
        pushBody: `${actorName} adicionou você como seguidor de "${shortTitle}"`,
        emailSubject: `👥 ${boardPrefix}Você foi adicionado como seguidor de "${demandTitle}"`,
        emailMessage: `${actorName} adicionou você como seguidor da demanda "${demandTitle}". Você pode acompanhar e executar a demanda.`,
        link,
      };
    case "promoted_primary":
      return {
        inAppTitle: "Você agora é o responsável principal",
        inAppMessage: `${actorName} promoveu você a responsável principal da demanda "${demandTitle}".`,
        inAppType: "info",
        pushTitle: `⭐ ${boardPrefix}Você é o responsável principal`,
        pushBody: `${actorName} promoveu você a responsável de "${shortTitle}"`,
        emailSubject: `⭐ ${boardPrefix}Você é o responsável principal de "${demandTitle}"`,
        emailMessage: `${actorName} promoveu você a responsável principal da demanda "${demandTitle}".`,
        link,
      };
    case "unassigned":
      return {
        inAppTitle: "Você foi removido de uma demanda",
        inAppMessage: `${actorName} removeu você dos responsáveis da demanda "${demandTitle}".`,
        inAppType: "warning",
        pushTitle: `🚪 ${boardPrefix}Você foi removido de uma demanda`,
        pushBody: `${actorName} removeu você de "${shortTitle}"`,
        emailSubject: `🚪 ${boardPrefix}Você foi removido de "${demandTitle}"`,
        emailMessage: `${actorName} removeu você dos responsáveis da demanda "${demandTitle}".`,
        link,
      };
  }
}

/**
 * Dispara notificação multicanal (in-app, push e e-mail) para o usuário afetado
 * por uma mudança de responsável/seguidor em uma demanda. Falhas em um canal
 * não bloqueiam os outros.
 */
export async function notifyDemandAssigneeChange(
  params: NotifyDemandAssigneeChangeParams
): Promise<void> {
  if (params.userId === params.actorId) return;

  const msg = buildMessages(params);
  const origin = buildAppOrigin();
  const fullActionUrl = `${origin}${msg.link}`;

  // 1) In-app
  const inAppPromise = supabase
    .from("notifications")
    .insert({
      user_id: params.userId,
      title: msg.inAppTitle,
      message: msg.inAppMessage,
      type: msg.inAppType,
      link: msg.link,
    })
    .then((res) => {
      if (res.error) {
        console.warn("[demandAssigneeNotifications] in-app failed:", res.error);
      }
    });

  // 2) Push
  const pushPromise = sendPushNotification({
    userIds: [params.userId],
    title: msg.pushTitle,
    body: msg.pushBody,
    link: msg.link,
    data: {
      type: `demand_assignee_${params.event}`,
      demandId: params.demandId,
      boardName: params.boardName || "",
    },
    notificationType: "demandUpdates",
  }).catch((err) => {
    console.warn("[demandAssigneeNotifications] push failed:", err);
  });

  // 3) E-mail (a edge respeita a preferência emailNotifications)
  const emailPromise = supabase.functions
    .invoke("send-email", {
      body: {
        to: params.userId,
        subject: msg.emailSubject,
        template: "notification",
        templateData: {
          title: msg.inAppTitle,
          message: msg.emailMessage,
          actionUrl: fullActionUrl,
          actionText: "Abrir demanda",
          type: msg.inAppType,
        },
      },
    })
    .then((res) => {
      if (res.error) {
        console.warn("[demandAssigneeNotifications] email failed:", res.error);
      }
    })
    .catch((err) => {
      console.warn("[demandAssigneeNotifications] email exception:", err);
    });

  await Promise.allSettled([inAppPromise, pushPromise, emailPromise]);
}
