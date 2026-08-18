# Acabar com e-mails duplicados (1 e-mail por ação)

## O que foi verificado agora

Não existe hoje nenhum registro de envios de e-mail no banco (só `test_email_log`), então a duplicidade foi rastreada lendo os caminhos de envio e conferindo as notificações internas gravadas.

### 1. Nova solicitação de demanda — duplicidade confirmada no código
Ao criar uma solicitação, o app dispara **dois** envios para as mesmas pessoas:
- a função `notify-demand-request`, que manda o e-mail rico "Nova Solicitação de Demanda" via Resend para todos os admins/moderadores/executores do quadro;
- logo em seguida, o push (`sendDemandRequestPushNotification`) sem o sinalizador de "não espelhar", e a função de push **gera um segundo e-mail** (espelho) para cada usuário.

Resultado: 2 e-mails por solicitação, por destinatário.

### 2. Aprovação do cliente / ajuste — duplicidade confirmada no código
Na mudança de status pelo Kanban, o criador da demanda recebe o e-mail "Status atualizado" sempre que o novo status é `Entregue`, `Aprovação do Cliente` ou `Em Ajuste`. Logo depois, o mesmo evento dispara o e-mail de aprovação (`notifyApproval`) ou o de ajuste — para o mesmo criador. São 2 e-mails para a mesma ação.

### 3. Aprovação interna e responsável principal — diagnóstico ainda não fechado
As notificações internas repetidas de "Aprovação interna pendente" que existem no banco estão separadas por mais de uma hora, ou seja, são transições diferentes, não um envio duplo. Para responsável/atribuição, o que está comprovadamente duplicado é a **notificação interna**: o app insere a notificação e, além disso, gatilhos antigos do banco (`notify_assignee_added`, `notify_demand_assigned`, `notify_demand_request_created`) inserem outra com texto diferente. Isso não gera e-mail, mas dá a sensação de repetição.
Para o e-mail desses dois casos, ainda falta prova — por isso o plano inclui registro de envios antes de qualquer conclusão adicional.

## Correção proposta

### Etapa 1 — Blindagem central (resolve qualquer duplicidade, inclusive as não mapeadas)
- Criar a tabela `email_send_log` (destinatário, assunto, chave de idempotência, origem, status, data) com RLS restrita a admin.
- A função `send-email` passa a: calcular uma chave de idempotência (destinatário + tipo de evento + id da demanda/solicitação + status), **recusar reenvio** de uma chave já registrada nos últimos 10 minutos e gravar todo envio no log.
- O espelho de e-mail da função de push usa a mesma chave, então o espelho nunca sai se o e-mail rico já saiu — mesmo que algum ponto do app esqueça de marcar "não espelhar".

Com isso, "um e-mail por ação" passa a ser garantido no servidor, e não em cada tela.

### Etapa 2 — Corrigir os dois pontos confirmados
- Solicitação de demanda: o push deixa de espelhar e-mail (o e-mail rico da função continua sendo o único).
- Mudança de status: quando o novo status for de aprovação ou ajuste, o e-mail genérico "Status atualizado" deixa de ser enviado, pois o fluxo específico já envia um e-mail melhor.

### Etapa 3 — Limpar as notificações internas duplicadas
Remover os gatilhos antigos do banco que inserem notificação interna já criada pelo app (atribuição de responsável e nova solicitação), mantendo apenas um registro por evento.

### Etapa 4 — Verificação
- Executar uma solicitação de teste, uma aprovação interna, uma aprovação de cliente e uma troca de responsável.
- Consultar `email_send_log` e confirmar exatamente 1 linha por destinatário/evento (e as recusas por idempotência, se houver).
- Reportar o resultado com os números, para comprovar a queda de consumo no Resend.

## Detalhes técnicos

- Migração: tabela `email_send_log` (`id`, `recipient_user_id`, `recipient_email`, `subject`, `event_key`, `source`, `status`, `error`, `created_at`), índice único parcial por `event_key`, GRANTs para `authenticated`/`service_role` e política de leitura só para admin do sistema.
- `supabase/functions/send-email/index.ts`: aceitar `eventKey` opcional no corpo; se ausente, derivar de `to + subject`; checar log antes de chamar o gateway Resend; gravar resultado. Redeploy.
- `supabase/functions/send-push-notification/index.ts`: `sendMirrorEmail` passa `eventKey` derivado de `type + demandId + userId`. Redeploy.
- `src/hooks/useDemandRequests.ts`: `sendDemandRequestPushNotification({ ..., mirrorEmail: false })` e repasse do parâmetro no helper em `src/hooks/useSendPushNotification.ts`.
- `src/components/KanbanBoard.tsx`: remover `"Aprovação do Cliente"` e `"Em Ajuste"` de `importantStatuses` do e-mail de status (mantendo `Entregue`).
- Migração adicional: `DROP TRIGGER on_assignee_added`, `on_demand_assigned` e `on_demand_request_created` (as notificações equivalentes já são criadas pelo app/edge function).
