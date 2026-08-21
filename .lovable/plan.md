# Fase 4.1 — Rollout interno do OAuth Google Calendar (PROD)

Backend PROD `erxhxmetrvkigjwxchbj`. Callback, OAuth client, scopes, login Google atual, demais Edge Functions, reuniões, Meet, autoaccept, cron e demandas permanecem intocados. Fase 4 não será refeita.

## Estado atual auditado

- `app_feature_flags` contém hoje 2 linhas booleanas: `google_calendar_enabled = false` e `google_calendar_auto_accept_enabled = false`.
- `get_google_calendar_connection_status()` devolve `enabled` (lido de `app_feature_flags`), `status`, `google_account_email`, `connected_at`, `updated_at`.
- `_shared/google-calendar/config.ts` hoje dá precedência ao ENV `GOOGLE_CALENDAR_ENABLED` quando definido, e só cai para o banco quando o ENV está ausente/vazio. Esse é o ponto ambíguo a ser resolvido.

## 1. Modelo de rollout (migration aditiva)

Nova coluna `rollout` (texto, default `'off'`, valores válidos `off | internal | all`) em `app_feature_flags`. `rollout` passa a ser a **única fonte de verdade** do estado da feature. A coluna `enabled` permanece apenas por compatibilidade legada e nenhum código novo decide disponibilidade por ela; sempre que `enabled` precisar ser exposto, será **calculado** como `rollout <> 'off'` (sem dois estados sincronizados). A linha `google_calendar_enabled` recebe `rollout = 'internal'`.

Nova tabela `public.google_calendar_rollout_users`:
- `user_id uuid PK` referenciando `auth.users`, `created_at`, `note text`.
- GRANT apenas para `service_role`; RLS ligado sem policies para `anon`/`authenticated` — a allowlist nunca é legível pelo cliente.

Nenhum DROP/RENAME/DELETE. Nada existente é alterado além do `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## 2. Precedência ENV × DB (comportamento final documentado)

Regra única, aplicada tanto na RPC quanto nas Edge Functions:

```text
GOOGLE_CALENDAR_ENABLED = "false"  -> kill switch absoluto: feature off para todos
qualquer outro valor / ausente     -> decide o banco (coluna rollout)
   rollout = off       -> ninguém
   rollout = internal  -> apenas user_id na allowlist
   rollout = all       -> todos os usuários autenticados
```

O ENV deixa de ligar a feature; ele só pode desligá-la. A fonte de verdade do rollout passa a ser exclusivamente o banco. Como o banco não enxerga o ENV, o kill switch é aplicado nas Edge Functions (start/callback/disconnect) e o frontend depende da RPC — por isso o kill switch será também refletido no banco na hora de usá-lo (procedimento documentado: setar `rollout='off'`).

## 3. RPC de status

`get_google_calendar_connection_status()` (SECURITY DEFINER, `auth.uid()`, sem parâmetros) passa a retornar também:

- `available boolean` — `true` quando `rollout='all'`, ou `rollout='internal'` e `auth.uid()` está na allowlist; senão `false`.
- `enabled` continua exposto (`rollout <> 'off'`) para compatibilidade.

A allowlist inteira nunca é retornada — só o booleano do próprio usuário.

## 4. Backend `google-calendar-oauth-start`

Ordem de verificação: JWT válido (senão `401`) → kill switch ENV → resolução do rollout no banco para `auth.uid()`. Sem autorização, retorna `403 { error: "FEATURE_NOT_AVAILABLE" }` **antes** de qualquer insert, garantindo zero linhas em `google_oauth_states`. Nenhuma confiança no frontend.

`google-calendar-oauth-callback` e `google-calendar-disconnect` passam a usar o mesmo helper de rollout (o callback rejeita quando o usuário perdeu autorização), sem mudança de contrato, URL ou scopes.

## 5. Frontend

`IntegrationsSection.tsx` e `useGoogleCalendarConnection.ts` passam a usar `available` no lugar de `enabled`:
- `available = true` → card "Google Calendar" com botão **Conectar** (ou Conectado/Desconectar).
- `available = false` → card com badge **Em breve** e botão desabilitado.

Nada de UI de reunião.

## 6. Allowlist

A migration cria a tabela vazia. Se você me passar os `user_id` (ou e-mails, que eu resolvo para id), incluo-os na mesma execução; caso contrário entrego a estrutura pronta e adiciono depois.

## 7. Testes desta fase

- anon em `oauth-start` → `401`.
- usuário autenticado fora da allowlist → `403 FEATURE_NOT_AVAILABLE` e verificação por query de que `google_oauth_states` não ganhou linhas.
- usuário na allowlist → `oauth-start` responde `200` com `authorization_url` (a URL não será aberta; nenhum consentimento Google real será executado).
- RPC retornando `available` correto para os dois perfis.
- Regressão: login por e-mail, login Google atual, Settings, criação/edição de demanda e navegação principal via preview.

## Entrega final

Relatório com: migration aplicada, modelo de rollout, usuários na allowlist, precedência ENV × DB, resultado dos testes autorizado/não autorizado/anon e confirmação de ausência de regressão. Paro nesta Fase 4.1.
