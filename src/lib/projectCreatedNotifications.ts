import { supabase } from "@/integrations/supabase/client";
import { fetchPreferencesForUsers, shouldNotifyUser } from "@/lib/notificationDispatch";

/**
 * Base URL used inside the e-mail link. The e-mail sender only accepts approved
 * https domains, so a local/preview origin falls back to the production domain.
 */
function buildAppOrigin(): string {
  const origin = typeof window !== "undefined" ? window.location?.origin : "";
  if (origin && /^https:\/\//i.test(origin) && !/localhost|127\.0\.0\.1/i.test(origin)) return origin;
  return "https://pla.soma.lefil.com.br";
}

/**
 * Avisa por e-mail, a quem precisa configurar o faturamento, que um projeto foi criado.
 *
 * Os destinatários vêm da RPC `get_project_billing_recipients` (dono da equipe +
 * quem pode lançar faturamento, menos quem criou o projeto). A notificação in-app
 * já é criada por um gatilho no banco; aqui só cuidamos do e-mail.
 *
 * Falhas nunca bloqueiam a criação do projeto — apenas registramos no console.
 */
export async function notifyProjectCreatedEmail(params: { projectId: string; projectName: string }): Promise<void> {
  const { projectId, projectName } = params;
  try {
    const { data, error } = await supabase.rpc("get_project_billing_recipients", { _project_id: projectId });
    if (error) {
      console.warn("[projectCreatedNotifications] recipients failed:", error);
      return;
    }
    const recipients = ((data ?? []) as unknown[]).map((r) => String(r)).filter(Boolean);
    if (!recipients.length) return;

    const prefsMap = await fetchPreferencesForUsers(recipients);
    const link = `/app/projects/${projectId}/finance?aba=revenue`;
    const actionUrl = `${buildAppOrigin()}${link}`;
    const title = `Novo projeto criado: ${projectName}`;
    const message = `O projeto "${projectName}" foi criado. Configure o faturamento desse projeto.`;

    await Promise.allSettled(recipients.map(async (userId) => {
      const prefs = prefsMap.get(userId);
      if (prefs && !shouldNotifyUser(prefs, { channel: "email", type: "teamUpdates", isUserAssigned: true })) return;
      try {
        const { error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            to: userId,
            subject: title,
            template: "notification",
            templateData: {
              title,
              message,
              actionUrl,
              actionText: "Configurar faturamento",
              type: "info",
            },
          },
        });
        if (emailError) console.warn("[projectCreatedNotifications] email failed:", emailError);
      } catch (err) {
        console.warn("[projectCreatedNotifications] email exception:", err);
      }
    }));
  } catch (err) {
    console.warn("[projectCreatedNotifications] failed:", err);
  }
}
