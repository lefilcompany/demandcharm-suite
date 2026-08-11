# Corrigir e-mails de notificação duplicados

## Causa raiz confirmada

Existem dois caminhos de e-mail rodando para o mesmo evento:

1. O código do app envia um e-mail próprio (assunto detalhado, ex.: "[CLIENTE: LUMI] Aprovação interna pendente: [story] Brinde sem complicação", com link público da demanda).
2. Logo depois, o mesmo código dispara o push, e a função de push **espelha automaticamente um segundo e-mail** usando só o título da notificação (ex.: "🔵 [CLIENTE: LUMI] Aprovação interna pendente").

Isso é exatamente o par de e-mails do print. O mesmo padrão (e-mail próprio + push com espelho) acontece em:

- Aprovações internas/externas
- Atribuição de responsável/seguidores em demanda
- Entrada/saída/promoção em quadro
- Solicitação de ajuste (interno/externo) e ajuste concluído

## Correção

Manter **um único e-mail por evento**, sempre o e-mail rico do app (com assunto completo e link correto), e desligar o espelhamento automático nesses casos.

1. A função de push passa a aceitar um sinalizador de espelhamento de e-mail. Quando o chamador já enviou o próprio e-mail, o espelho não é gerado.
2. O utilitário central de push do app passa a repassar esse sinalizador.
3. Todos os pontos que hoje enviam e-mail próprio + push passam a marcar "não espelhar":
   - aprovações, atribuição de demanda, membros de quadro, ajustes (solicitação e conclusão), anexos.
4. Eventos que **só** disparam push (sem e-mail próprio, ex.: menções no chat e comentários) continuam com o espelho ligado, para não perder o e-mail.
5. Deduplicação extra de segurança nas listas de destinatários (mesmo usuário não recebe duas vezes na mesma chamada).

## Detalhes técnicos

- `supabase/functions/send-push-notification/index.ts`: novo campo opcional no corpo (`mirrorEmail`, padrão `true`); quando `false`, pula o bloco de espelho e reporta `skipped`. Redeploy da função.
- `src/hooks/useSendPushNotification.ts`: parâmetro `mirrorEmail?: boolean` em `sendPushNotification` e repasse nos helpers (`sendAdjustmentPushNotification`, `sendAdjustmentCompletionPushNotification`), mantendo o padrão atual para menções/comentários.
- `src/lib/approvalNotifications.ts`, `src/lib/demandAssigneeNotifications.ts`, `src/lib/boardMemberNotifications.ts`, `src/pages/DemandDetail.tsx`, `src/components/KanbanBoard.tsx`, `src/components/KanbanAdjustmentDialog.tsx`, `src/components/AttachmentUploader.tsx`: passar `mirrorEmail: false` nas chamadas de push que já têm envio de e-mail próprio.
- Verificação após o ajuste: consultar o log de envios para confirmar um único e-mail por destinatário/evento em uma transição de aprovação de teste.
