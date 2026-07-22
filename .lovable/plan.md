
## Objetivo

Hoje os e-mails do sistema (criação de demanda, vencimento, aprovações, mudanças de quadro, etc.) saem pela edge function `send-email` chamando **Resend** diretamente com o remetente `noreply@pla.soma.lefil.com.br`. Vou migrar todo esse fluxo para a infraestrutura oficial de **Lovable Emails** (fila pgmq + retry + log + supressão) e te passar o DNS certo para configurar no seu provedor.

## Diagnóstico atual

- `supabase/functions/send-email/index.ts` → envia via Resend REST API.
- `RESEND_API_KEY` é o secret usado; se estiver inválido/expirado ou o domínio no Resend não estiver verificado, tudo falha silenciosamente para o usuário final.
- Chamadores desse endpoint (todos vão continuar funcionando sem mudar):
  - `src/hooks/useSendEmail.ts`
  - `src/lib/approvalNotifications.ts`
  - `src/lib/boardMemberNotifications.ts`
  - `supabase/functions/check-deadlines/*` (vencimento)
  - `supabase/functions/notify-demand-request/index.ts`
  - `supabase/functions/process-recurring-demands/*`
  - demais lugares que fazem `functions.invoke('send-email', ...)`
- Nenhum domínio de e-mail está configurado no Lovable ainda (`project email setup: not_started`).

## Plano de execução

### Passo 1 — Configurar domínio de envio no Lovable
Vou abrir o diálogo de setup de e-mail para você escolher/confirmar o subdomínio remetente. Recomendo `notify.soma.lefil.com.br` (subdomínio dedicado é a melhor prática — não conflita com e-mails corporativos do domínio raiz).

<presentation-actions>
<presentation-open-email-setup>Configurar domínio de e-mail</presentation-open-email-setup>
</presentation-actions>

### Passo 2 — DNS no seu provedor
Depois que você concluir o diálogo, o Lovable mostra os **registros NS exatos** para o subdomínio escolhido (algo como `ns1.lovable.cloud` / `ns2.lovable.cloud`, mas os valores reais são os que aparecerem lá — não invento). O que você precisará fazer no seu provedor de DNS (onde `soma.lefil.com.br` está hospedado):

1. Entrar no painel do provedor (Registro.br, Cloudflare, GoDaddy, etc.).
2. Criar **2 registros NS** para o host `notify` (ou o subdomínio escolhido) com os valores que o painel do Lovable mostrar.
3. **Não** criar SPF/DKIM/MX manualmente — o Lovable gerencia isso automaticamente dentro do subdomínio delegado.
4. Salvar e aguardar propagação (até 72h, geralmente <1h).
5. Voltar em **Cloud → Emails** e clicar em **Verify Domain** se não verificar sozinho.

Observação: se `soma.lefil.com.br` estiver no **Shopify DNS**, ele não suporta registros NS — nesse caso a alternativa é mover o DNS pra Cloudflare (gratuito) ou transferir o domínio pro Lovable. Te aviso se cair nesse caso.

### Passo 3 — Provisionar infraestrutura de e-mail
Rodar `email_domain--setup_email_infra` — cria filas pgmq (`transactional_emails`), tabelas `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`, cron `process-email-queue`, e RPC `enqueue_email`. Não precisa DNS verificado pra isso rodar.

### Passo 4 — Scaffold de templates transacionais
Rodar `email_domain--scaffold_transactional_email` — cria as edge functions `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression` e templates React Email base.

### Passo 5 — Criar template "notification" com a identidade SoMA+
Criar `supabase/functions/_shared/transactional-email-templates/notification.tsx` com o mesmo conteúdo visual do template atual (`send-email/_templates/notification.tsx`), respeitando a paleta oficial (Primary `#F28705`, Dark `#1D1D1D`, fundo `#ffffff`). Registrar em `registry.ts`.

### Passo 6 — Refatorar `send-email` como wrapper
Manter a edge function `send-email` (para não quebrar nenhum chamador existente), mas por dentro ela vai:
- Continuar validando auth, payload e resolvendo UUID → email.
- Continuar respeitando `emailNotifications = false`.
- Em vez de chamar Resend, chamar `supabase.functions.invoke('send-transactional-email', { body: { templateName: 'notification', recipientEmail, idempotencyKey, templateData } })`.
- Manter idempotência derivada do `subject + userId + timestamp` truncado, para retries seguros.

Assim **nenhum chamador precisa mudar** — nem front, nem outras edges (`check-deadlines`, `notify-demand-request`, `process-recurring-demands`, aprovações, board membership, etc.).

### Passo 7 — Deploy e validação
- `deploy_edge_functions` em: `send-email`, `send-transactional-email`, `process-email-queue`, `handle-email-unsubscribe`, `handle-email-suppression`.
- Verificar que `email_send_log` recebe registros com status `pending` → `sent`.
- Explicar como acompanhar em **Cloud → Emails** (fila, DLQ, supressões).
- Apontar que enquanto o DNS não verifica, os e-mails ficam enfileirados e saem automaticamente após verificação.

### Passo 8 — Remover dependência do Resend (só depois de validar)
Deixar `RESEND_API_KEY` no secrets temporariamente. Depois que confirmarmos que o fluxo Lovable Emails está entregando, removo o secret e o código morto. **Não faço isso nesta rodada** — só marco como próximo passo.

## O que NÃO vou fazer

- Não vou tocar em nenhuma lógica de negócio dos chamadores (aprovações, deadlines, recurring, membros de quadro).
- Não vou mexer em e-mails de auth do Supabase — esses continuam pelo template padrão do Lovable. Se você quiser customizar depois, é outro fluxo (`scaffold_auth_email_templates`).
- Não vou criar registros DNS por você — o Lovable só entrega os valores, você adiciona no provedor.

## Pergunta única antes de executar

Confirmar o subdomínio remetente: **`notify.soma.lefil.com.br`** (recomendado) ou você prefere outro (ex.: `mail.soma.lefil.com.br`, `pla.soma.lefil.com.br`)? Se topar `notify`, é só aprovar o plano e eu sigo.
