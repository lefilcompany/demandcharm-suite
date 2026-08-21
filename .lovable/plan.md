# Fase 4 — Infraestrutura OAuth Google Calendar na PROD (somente conectar/desconectar)

## Backend PROD identificado (não será alterado)

- SUPABASE_URL: `https://erxhxmetrvkigjwxchbj.supabase.co`
- PROJECT_REF: `erxhxmetrvkigjwxchbj`
- **URL REAL do callback a cadastrar no Google Cloud (OAuthSomaCalendarProd):**
  `https://erxhxmetrvkigjwxchbj.supabase.co/functions/v1/google-calendar-oauth-callback`

O placeholder `<PROJECT_REF_PROD>` deve ser substituído por essa URL. Nenhuma referência a `soma-calendar-dev.lovable.app` ou `solpxywfpoeslqnguaoe` entrará na PROD.

## Auditoria da PROD (feita antes de planejar)

- Não existem na PROD: `google_oauth_states`, `google_calendar_connections`, `google_calendar_connection_status`, nem as Edge Functions `google-calendar-oauth-start/callback/disconnect`. Nada será sobrescrito.
- **Conflito encontrado (único):** existe a tabela legada `public.google_calendar_tokens` (colunas `id, user_id, access_token, refresh_token, token_expires_at, created_at, updated_at`), com RLS por `auth.uid()`, **0 registros** e **sem nenhuma referência no código**. Ela guarda tokens em texto plano e não atende ao modelo do DEV. Decisão: **não tocar nela** (sem DROP, sem RENAME). A nova arquitetura usa nomes distintos. Sugiro remover essa tabela em uma fase futura, após sua confirmação.
- Secrets Google já existentes na PROD (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) pertencem a outros usos e **não serão reutilizados nem alterados**. O Calendar terá secrets próprios com prefixo `GOOGLE_CALENDAR_*`.
- `ENVIRONMENT` e `APP_URL` já existem na PROD e serão apenas lidos.

## Checkpoint

Antes de qualquer alteração, registro o checkpoint de código `pre-calendar-oauth-phase-4` (marco de rollback do frontend/functions).

## Ordem de execução

migration → validar DB/RLS/RPC → deploy das Edge Functions → testar com flag OFF → frontend Settings → testes de regressão.

## Banco (migration única, 100% aditiva, com IF NOT EXISTS)

`public.google_oauth_states`
- `id`, `user_id` (FK auth.users, on delete cascade), `state_hash` (unique, SHA-256 do state), `redirect_path`, `created_at`, `expires_at` (default now()+10min), `used_at`.
- Índices em `user_id` e `expires_at`. Single-use garantido por consumo atômico no callback:
  `UPDATE ... SET used_at = now() WHERE state_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id, redirect_path` — sem SELECT prévio, sem janela de race.
- RLS ligado, **sem policies para anon/authenticated** (acesso exclusivo de service_role nas Edge Functions). GRANT ALL para `service_role`.

`public.google_calendar_connections`
- `user_id` (PK, FK auth.users, cascade) — garante 1 conexão por usuário, `google_account_email`, `google_account_id` (`sub` do Google), `refresh_token_encrypted`, `scopes text[]`, `status` (`connected` | `revoked` | `error`, compatível com o DEV homologado — a Fase 2 depende de `status === "connected"`), `connected_at`, `disconnected_at`, `last_error`, `created_at`, `updated_at`.
- RLS ligado, sem policies para `authenticated`; GRANT ALL apenas para `service_role`. Nenhum acesso direto do frontend.

`public.get_google_calendar_connection_status()` — RPC SECURITY DEFINER (substitui a view)
- Deriva o usuário exclusivamente de `auth.uid()` (não aceita parâmetro de usuário); `SET search_path = public`; `STABLE`.
- Retorna apenas campos não sensíveis: `enabled` (flag lida de config server-side), `status`, `google_account_email`, `connected_at`, `updated_at`. Nunca retorna `refresh_token_encrypted`.
- `REVOKE EXECUTE ... FROM public, anon` e `GRANT EXECUTE ... TO authenticated`.
- A flag é lida de uma tabela/linha de configuração `public.app_feature_flags` (nova, aditiva, somente leitura via a própria RPC), inicializada com `google_calendar_enabled = false`, para que o frontend saiba o estado sem chamar `oauth-start`.

Nenhum DROP, DELETE, TRUNCATE ou RENAME. Nenhuma tabela existente é modificada.

## Edge Functions (3 novas, nenhuma existente tocada)

Helpers compartilhados novos em `supabase/functions/_shared/google-calendar/` (crypto AES-GCM, flags, config), preservando nomes e contratos do DEV homologado — sem refactor arquitetural, para facilitar o porte da Fase 2.

1. `google-calendar-oauth-start` — só é chamado quando o usuário clica em "Conectar Google Calendar"; exige JWT SoMA válido (validação em código); revalida a flag server-side e retorna 403 `FEATURE_DISABLED` se desligada; gera state aleatório (32 bytes), grava só o hash com expiração de 10 min; monta a URL do Google com `access_type=offline`, `prompt=consent`, `include_granted_scopes=true` e scopes `openid email https://www.googleapis.com/auth/calendar.events.owned`; `redirect_uri` = callback real da PROD.
2. `google-calendar-oauth-callback` — sem JWT do browser (`verify_jwt=false`, redirect vindo do Google); trata `error=access_denied`; consome o state de forma atômica (inválido/expirado/reutilizado → redirect com erro); troca `code` por tokens com o client PROD; **obtém a identidade Google consultando o endpoint OpenID Connect `userinfo` com o access token recém-emitido** (sem confiar em decode do `id_token`), persistindo `google_account_id = sub` e `google_account_email = email`; criptografa o refresh token com AES-GCM usando `GOOGLE_TOKEN_ENCRYPTION_KEY`; faz upsert em `google_calendar_connections` com `status = 'connected'`; redireciona para `https://pla.soma.lefil.com.br/settings?tab=integrations&calendar=connected|error=<codigo>`. Nunca loga nem devolve tokens.
3. `google-calendar-disconnect` — exige sessão autenticada, opera só em `auth.uid()` (sem aceitar `user_id` do cliente); tenta `POST https://oauth2.googleapis.com/revoke`; marca a conexão como `revoked`, preenche `disconnected_at` e limpa o refresh token.

## Frontend (mínimo, sem nada de reunião)

- Nova aba **Integrações** em `src/pages/Settings.tsx` + `src/components/settings/IntegrationsSection.tsx` com um único card "Google Calendar".
- Novo hook `src/hooks/useGoogleCalendarConnection.ts`: lê `enabled`/`status`/e-mail pela RPC segura (nunca via `oauth-start`) e chama as functions de start/disconnect apenas em ação explícita do usuário.
- Com `enabled = false`, o card mostra "Em breve" e o botão fica desabilitado; `oauth-start` revalida a flag no servidor de qualquer forma.
- Nenhuma UI de reunião, nenhum campo em CreateDemand.



## Secrets que você precisa cadastrar manualmente (nenhum valor do DEV)

- `GOOGLE_CALENDAR_CLIENT_ID` — do OAuth Client `OAuthSomaCalendarProd`
- `GOOGLE_CALENDAR_CLIENT_SECRET` — idem
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — chave NOVA de produção (32 bytes base64); posso gerá-la de forma segura no cofre da PROD, sem nunca copiar a do DEV
- `GOOGLE_CALENDAR_ENABLED=false` e `GOOGLE_CALENDAR_AUTO_ACCEPT_ENABLED=false`
- `ENVIRONMENT=production` e `APP_URL=https://pla.soma.lefil.com.br` já existem — apenas confirmarei os valores

Enquanto os secrets não existirem, as functions falham de forma controlada (503) e nada mais é afetado.

## Testes desta fase

- Regressão: login por e-mail, login Google atual (callbacks `~oauth/callback` intocados), logout, refresh de sessão, criar/editar demanda, navegação, Settings, equipes, upload de anexo — via navegação automatizada no preview.
- Infra OAuth: `oauth-start` sem sessão → 401; com sessão e flag off → 403 `FEATURE_DISABLED`; `disconnect` sem sessão → 401; nenhuma linha criada em `google_oauth_states`.
- Não haverá teste real do fluxo com o Google nesta fase.

## Rollback

Sem DROP. Basta manter/definir `GOOGLE_CALENDAR_ENABLED=false` e, se preciso, reverter o commit do frontend. As tabelas ficam inertes.

## Ao final entrego o relatório completo

PROJECT_REF, SUPABASE_URL, URL exata do callback, migrations aplicadas, objetos criados, functions criadas, arquivos de frontend alterados, conflitos (a tabela legada), secrets pendentes e as confirmações de que nada do DEV foi copiado e nada da PROD foi apagado ou sobrescrito. Paro aqui — sem reuniões, Meet, sync, autoaccept, worker ou cron.
