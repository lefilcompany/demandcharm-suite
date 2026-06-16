import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/hooks/useSendPushNotification";
import { getBoardRoleLabel } from "@/lib/boardRoleLabels";

export type BoardMemberEvent = "added" | "removed" | "role_changed";

interface NotifyBoardMemberChangeParams {
  event: BoardMemberEvent;
  /** ID do usuário afetado (destinatário da notificação) */
  userId: string;
  /** ID do quadro */
  boardId: string;
  /** Nome do quadro */
  boardName: string;
  /** Novo cargo do usuário no quadro (no caso de remoção, é o cargo que ele tinha) */
  newRole: string;
  /** Cargo anterior — apenas em role_changed */
  oldRole?: string;
  /** ID de quem realizou a ação */
  actorId: string;
  /** Nome de quem realizou a ação */
  actorName: string;
}

interface UserPrefRow {
  user_id: string;
  preference_value: {
    emailNotifications?: boolean;
    teamUpdates?: boolean;
  } | null;
}

/**
 * Lê as preferências de notificação do destinatário e decide se devemos enviar e-mail.
 * Por padrão, se não houver preferências salvas, enviamos.
 */
async function shouldSendEmail(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("user_id, preference_value")
      .eq("user_id", userId)
      .eq("preference_key", "notification_preferences")
      .maybeSingle<UserPrefRow>();

    if (error) {
      console.warn("[boardMemberNotifications] failed reading prefs, defaulting to send:", error);
      return true;
    }
    const prefs = data?.preference_value ?? null;
    if (!prefs) return true;
    if (prefs.emailNotifications === false) return false;
    if (prefs.teamUpdates === false) return false;
    return true;
  } catch (err) {
    console.warn("[boardMemberNotifications] prefs lookup error, defaulting to send:", err);
    return true;
  }
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
  link?: string;
}

function buildMessages(params: NotifyBoardMemberChangeParams): BuiltMessages {
  const { event, boardName, newRole, oldRole, actorName } = params;
  const newRoleLabel = getBoardRoleLabel(newRole);
  const oldRoleLabel = oldRole ? getBoardRoleLabel(oldRole) : undefined;
  const link = `/boards/${params.boardId}`;

  switch (event) {
    case "added":
      return {
        inAppTitle: "Você foi adicionado a um quadro",
        inAppMessage: `${actorName} adicionou você ao quadro "${boardName}" como ${newRoleLabel}.`,
        inAppType: "info",
        pushTitle: `👥 [${boardName}] Você foi adicionado ao quadro`,
        pushBody: `${actorName} adicionou você como ${newRoleLabel}`,
        emailSubject: `Você foi adicionado ao quadro ${boardName}`,
        emailMessage: `${actorName} adicionou você ao quadro "${boardName}" como ${newRoleLabel}. Você já pode acessar o quadro e suas demandas.`,
        link,
      };
    case "removed":
      return {
        inAppTitle: "Você foi removido de um quadro",
        inAppMessage: `${actorName} removeu você do quadro "${boardName}" (era ${newRoleLabel}).`,
        inAppType: "warning",
        pushTitle: `🚪 [${boardName}] Você foi removido do quadro`,
        pushBody: `${actorName} removeu você do quadro (era ${newRoleLabel})`,
        emailSubject: `Você foi removido do quadro ${boardName}`,
        emailMessage: `${actorName} removeu você do quadro "${boardName}". Seu cargo anterior era ${newRoleLabel}.`,
        link: undefined,
      };
    case "role_changed": {
      const fromTo = oldRoleLabel
        ? `de ${oldRoleLabel} para ${newRoleLabel}`
        : `para ${newRoleLabel}`;
      return {
        inAppTitle: "Seu cargo foi atualizado",
        inAppMessage: `${actorName} alterou seu cargo no quadro "${boardName}" ${fromTo}.`,
        inAppType: "info",
        pushTitle: `🔄 [${boardName}] Seu cargo foi alterado`,
        pushBody: oldRoleLabel
          ? `Agora você é ${newRoleLabel} (antes: ${oldRoleLabel}) — por ${actorName}`
          : `Agora você é ${newRoleLabel} — por ${actorName}`,
        emailSubject: `Seu cargo no quadro ${boardName} foi atualizado`,
        emailMessage: `${actorName} alterou seu cargo no quadro "${boardName}" ${fromTo}.`,
        link,
      };
    }
  }
}

/**
 * Dispara notificação multicanal (in-app, push e e-mail) para o usuário afetado
 * por uma mudança de membro de quadro.
 *
 * - In-app: insere via RPC SECURITY DEFINER `create_board_membership_notification`.
 * - Push: via edge `send-push-notification` (filtra por preferência `teamUpdates`).
 * - E-mail: via edge `send-email`, respeitando `emailNotifications` e `teamUpdates`.
 *
 * Falhas em um canal não bloqueiam os outros — apenas logamos no console.
 */
export async function notifyBoardMemberChange(
  params: NotifyBoardMemberChangeParams
): Promise<void> {
  // Não notificar a si mesmo (caso raro: alterar o próprio cargo)
  if (params.userId === params.actorId) {
    return;
  }

  const msg = buildMessages(params);
  const origin = buildAppOrigin();
  const fullActionUrl = msg.link ? `${origin}${msg.link}` : undefined;

  // 1) In-app via RPC
  const inAppPromise = supabase
    .rpc("create_board_membership_notification", {
      p_user_id: params.userId,
      p_board_id: params.boardId,
      p_title: msg.inAppTitle,
      p_message: msg.inAppMessage,
      p_type: msg.inAppType,
      p_link: msg.link ?? null,
    })
    .then((res) => {
      if (res.error) {
        console.warn("[boardMemberNotifications] in-app failed:", res.error);
      }
    });

  // 2) Push (já filtra por preferência teamUpdates dentro da edge function)
  const pushPromise = sendPushNotification({
    userIds: [params.userId],
    title: msg.pushTitle,
    body: msg.pushBody,
    link: msg.link ?? "/",
    data: {
      type: `board_member_${params.event}`,
      boardId: params.boardId,
      boardName: params.boardName,
      role: params.newRole,
      ...(params.oldRole ? { oldRole: params.oldRole } : {}),
    },
    notificationType: "teamUpdates",
  }).catch((err) => {
    console.warn("[boardMemberNotifications] push failed:", err);
  });

  // 3) E-mail (verificamos preferência client-side antes de chamar)
  const emailPromise = (async () => {
    try {
      const allowed = await shouldSendEmail(params.userId);
      if (!allowed) {
        console.log(`[boardMemberNotifications] email skipped (user prefs) for ${params.userId}`);
        return;
      }
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: params.userId, // a edge resolve UUID -> e-mail
          subject: msg.emailSubject,
          template: "notification",
          templateData: {
            title: msg.inAppTitle,
            message: msg.emailMessage,
            actionUrl: fullActionUrl,
            actionText: fullActionUrl ? "Abrir quadro" : undefined,
            type: msg.inAppType,
          },
        },
      });
      if (error) {
        console.warn("[boardMemberNotifications] email failed:", error);
      }
    } catch (err) {
      console.warn("[boardMemberNotifications] email exception:", err);
    }
  })();

  await Promise.allSettled([inAppPromise, pushPromise, emailPromise]);
}
