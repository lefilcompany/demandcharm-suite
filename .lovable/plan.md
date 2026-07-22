## Contexto

O projeto **não tem domínio do Lovable Emails configurado** (`not_started`), então não há nada de "Lovable Emails" a desativar/remover — as tentativas anteriores nunca chegaram a provisionar infraestrutura.

Hoje quatro edge functions enviam email chamando **direto** `https://api.resend.com/emails` com `RESEND_API_KEY` como token do provider:
- `send-email`
- `send-reset-code`
- `notify-demand-request`
- `check-deadlines`

O workspace já tem o connector **Resend** linkado ao projeto (`lefil@lefil.com.br`, `uses connector gateway: true`). O padrão correto é rotear pelo **gateway do Lovable**, não pela API do Resend direto.

## O que muda

Refatorar as 4 functions para usar o gateway:

- URL: `https://connector-gateway.lovable.dev/resend/emails`
- Headers:
  - `Authorization: Bearer ${LOVABLE_API_KEY}`
  - `X-Connection-Api-Key: ${RESEND_API_KEY}`
  - `Content-Type: application/json`
- Body: o mesmo payload atual (`from`, `to`, `subject`, `html`, etc.)
- Tratar erros pelo status + body do gateway (não fazer fallback para `api.resend.com`).

Nada muda nos remetentes/templates: continua `noreply@pla.soma.lefil.com.br` (domínio já verificado no Resend do workspace) e nos templates React Email atuais.

`send-reset-code` hoje faz fallback para `RESEND_API_KEY_LEFIL`; com o gateway só precisamos do connector, então essa variável deixa de ser usada (fica apenas `RESEND_API_KEY`, que é o env var do connector).

## Passos

1. Atualizar `supabase/functions/send-email/index.ts` para chamar o gateway.
2. Atualizar `supabase/functions/send-reset-code/index.ts` (remover fallback `RESEND_API_KEY_LEFIL`).
3. Atualizar `supabase/functions/notify-demand-request/index.ts`.
4. Atualizar `supabase/functions/check-deadlines/index.ts` (dois pontos de envio).
5. Em cada function, validar `LOVABLE_API_KEY` e `RESEND_API_KEY` no início e logar `status + body` em falhas.
6. Deploy das 4 functions.
7. Teste rápido: disparar `send-email` com template `notification` e confirmar entrega + resposta 200 do gateway.

## Fora de escopo

- Não configurar/scaffoldar Lovable Emails (usuário escolheu Resend).
- Não mexer em templates, remetentes, domínio DNS, filas pgmq, cron.
- Não alterar callers no frontend — a interface das functions permanece igual.
