# Fim da duplicidade de e-mails + log completo de envios

Dois objetivos no mesmo trabalho: registrar tudo que é enviado (com destinatário, motivo, canal e resultado) e usar esse mesmo registro para impedir que a mesma ação gere dois e-mails.

## Parte 1 — Log de envios (nova base)

Nova tabela `email_send_log`, gravada pela função de envio a cada tentativa, com:

- destinatário (e-mail e usuário, quando identificado)
- assunto e tipo do evento (ex.: `demand_request_created`, `assignee_primary`, `internal_approval`, `status_changed`)
- chave de deduplicação (`dedupe_key`) e entidade relacionada (demanda/solicitação)
- canal de origem (chamada direta, espelho de push, cron)
- resultado: `sent`, `skipped_duplicate`, `skipped_preference`, `failed`
- id da mensagem no provedor, código HTTP e mensagem de erro
- quem/qual função disparou

Também registra explicitamente os casos "não enviei" (preferência desligada ou duplicata bloqueada), para que o histórico explique a ausência de um e-mail — hoje isso é invisível.

Tela nova em `/admin/email-logs` (somente administrador global): lista com filtros por período, destinatário, tipo de evento e resultado, contadores do dia (enviados, bloqueados por duplicidade, falhas) e detalhe de cada linha. A página existente de teste de e-mail continua como está.

## Parte 2 — Um e-mail por ação

A função de envio passa a aceitar `eventType` e `dedupeKey`. Antes de chamar o provedor, consulta `email_send_log`: se já existe envio com a mesma chave para o mesmo destinatário dentro da janela (10 minutos por padrão, configurável por evento), ela devolve sucesso marcando `skipped_duplicate` e não consome envio do Resend. Essa trava é a rede de segurança; além dela, as origens duplicadas são corrigidas na raiz:

1. **Nova solicitação de demanda** — a notificação push deixa de espelhar e-mail nesse fluxo; o e-mail rico da função de solicitação continua sendo o único.
2. **Aprovação interna / ajuste / aprovação externa** — o e-mail genérico de "status atualizado" deixa de disparar quando o status é de aprovação/ajuste, ficando apenas o e-mail específico daquele momento.
3. **Responsável principal e seguidores** — o envio passa a ocorrer em um único ponto; as duplicações vindas de gatilhos do banco que repetem a notificação interna criada pelo aplicativo são removidas, mantendo exatamente uma notificação interna por ação.

Depois do ajuste, cada ação gera: 1 e-mail, 1 push e 1 notificação interna por pessoa.

## Detalhes técnicos

- Migration: `CREATE TABLE public.email_send_log` + `GRANT` (leitura para `authenticated`, tudo para `service_role`) + RLS ativa + política de leitura `has_role(auth.uid(), 'admin')`. Escrita apenas via service role. Índices em `(dedupe_key, recipient_email, created_at DESC)`, `(created_at DESC)` e `(event_type)`.
- `supabase/functions/send-email/index.ts`: aceita `eventType`, `dedupeKey`, `sourceFunction`, `relatedEntityType/Id`; grava log em todos os caminhos de saída (duplicado, preferência desligada, sucesso, erro do provedor, exceção); a checagem de duplicidade roda depois da autorização e antes de renderizar o template.
- `supabase/functions/send-push-notification/index.ts`: `mirrorEmail` deixa de ser `true` por padrão nos fluxos que já enviam e-mail próprio; repassa `eventType`/`dedupeKey` quando espelha.
- `supabase/functions/notify-demand-request/index.ts` e `src/hooks/useDemandRequests.ts`: um único disparo de e-mail por solicitação, com `dedupeKey` = `demand_request_created:<request_id>:<recipient>`.
- `src/components/KanbanBoard.tsx`: exclui status de aprovação/ajuste do e-mail genérico de mudança de status.
- `src/lib/demandAssigneeNotifications.ts`: passa `dedupeKey` por demanda + usuário + papel.
- Migration adicional para remover os gatilhos redundantes de notificação interna (`notify_assignee_added` / `notify_demand_assigned` no trecho que duplica o que o aplicativo já grava), preservando os fluxos que só existem no banco.
- Nova página `src/pages/admin/AdminEmailLogs.tsx` + rota e item de menu no painel administrativo, seguindo o padrão visual das telas admin atuais.
- Validação: typecheck, e um envio de teste pela tela existente confirmando que a linha aparece no log e que um segundo disparo idêntico é registrado como bloqueado.
