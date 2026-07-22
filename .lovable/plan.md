# Plano — Corrigir push notifications FCM

## Objetivo
Resolver conflito entre SW da PWA e do Firebase, suportar múltiplos dispositivos por usuário, evitar notificação duplicada, e tornar o `send-push-notification` mais seguro e resiliente. Nada além do escopo push será tocado.

## Alterações

### 1. `public/firebase-messaging-sw.js`
- Atualizar imports para `firebase-*-compat` **10.14.1** (bater com o pacote instalado).
- **Remover** o `self.registration.showNotification(...)` dentro de `onBackgroundMessage`. Como o backend envia payload `notification`, o próprio browser já exibe — o handler manual causava notificação duplicada. Manter apenas leitura de `payload.data` para logging.
- Manter `notificationclick` / `notificationclose` / `install` / `activate` como estão (com `clients.claim()` e navegação para `data.link`).
- Continuar 100% classic worker (sem ES modules).

### 2. `src/lib/firebase.ts`
- Chamar `isSupported()` de `firebase/messaging` antes de instanciar `getMessaging`.
- Registrar o SW do Firebase **exclusivamente** em `/firebase-messaging-sw.js` com `scope: "/firebase-cloud-messaging-push-scope/"`, evitando colisão com `/sw.js` da PWA.
- Reusar registro existente via `navigator.serviceWorker.getRegistration(scope)` antes de registrar de novo.
- Passar exatamente esse `ServiceWorkerRegistration` para `getToken({ vapidKey, serviceWorkerRegistration })`.
- Ler config de `import.meta.env.VITE_FIREBASE_*` com fallback para os valores atuais (para não quebrar antes das envs serem adicionadas).
- Tratar: navegador incompatível, `!window.isSecureContext`, `Notification.permission === "denied"`, falha no registro do SW e erro no `getToken`. Retornar `{ token, registration } | null`.
- **Não logar o token completo** — apenas `token.slice(0,6) + "…"`.
- Exportar `deleteFcmToken()` que chama `deleteToken(messaging)`.
- Guardar única instância de `app` e `messaging`.

### 3. Nova tabela `public.fcm_tokens` (migration)
Colunas: `id uuid pk`, `user_id uuid → auth.users`, `token text unique`, `device_id text`, `user_agent text`, `created_at`, `updated_at`, `last_used_at`.
GRANTs para `authenticated` e `service_role`. RLS: usuário só lê/insere/atualiza/apaga os próprios registros; `service_role` full access. Trigger `update_updated_at_column`.

**Nada é migrado automaticamente** de `user_preferences.fcm_token` — chaves antigas ficam órfãs e serão limpas em migration separada depois que o novo fluxo estiver estável (fora de escopo desta entrega, apenas comentado no fim).

### 4. `src/hooks/usePushNotifications.ts`
- Trocar todos os `.single()` por `.maybeSingle()` e propagar `error` de todo `select/insert/update/delete`.
- Gerar `device_id` estável no `localStorage` (`soma:fcm_device_id`).
- `enablePushNotifications`: só chama `toast.success` **após** upsert na `fcm_tokens` bem-sucedido.
- Upsert por `(user_id, device_id)` — atualiza `token`, `user_agent`, `last_used_at`.
- `disablePushNotifications`: chama `deleteFcmToken()` no Firebase **e** deleta a row **apenas do dispositivo atual** (`device_id`).
- `isEnabled` = `permissionStatus === "granted"` **e** existe token para este `device_id`. Não considerar ativo só porque o banco tem token antigo.
- Remover o `useEffect` de `onForegroundMessage` daqui (vira global — ver item 5).

### 5. Listener foreground global
- Novo hook `src/hooks/useForegroundPushListener.ts` — registra `onMessage` uma única vez (guard `useRef`), mostra `toast` com título/corpo/ação `Ver`.
- Montado uma única vez em `src/components/layout/ProtectedLayout.tsx` (ou equivalente já existente na área autenticada — vou confirmar o nome exato ao aplicar).

### 6. `supabase/functions/send-push-notification/index.ts`
- Ler tokens da nova `fcm_tokens` (não mais de `user_preferences.fcm_token`), fazendo `select token,user_id` filtrado por `user_id in allowedUserIds`.
- Validar campos essenciais da service account (`client_email`, `private_key`, `project_id`) antes de assinar JWT; se faltar, 500 com mensagem sem vazar payload.
- Normalizar `link`: se não começar com `http`, prefixar `Deno.env.get("APP_URL")` (fallback `https://demandcharm-suite.lovable.app`).
- Refinar remoção de token: **apenas** quando resposta FCM contiver `UNREGISTERED`, `NOT_FOUND`, ou `errorCode === "UNREGISTERED"`, ou detalhe apontar `message.token` como inválido. **Não** remover em `INVALID_ARGUMENT` genérico.
- `DELETE` deve ser por `token` (não por `user_id`), preservando outros dispositivos.
- Sanitizar erros no retorno (mensagem curta, sem stack, sem access token, sem private key).
- Resposta: `{ success, sent, failed, skipped, blocked, errors: [{userId, code}] }`.
- Manter autorização atual (JWT ou CRON_SECRET/CRON_TOKEN) intacta.

### 7. `supabase/config.toml`
Já contém `verify_jwt = false` para `check-deadlines` e `send-push-notification`. Nenhuma mudança necessária. Não expor outras funções.

## Validação
Rodar e corrigir até verde:
- `bunx tsgo --noEmit`
- `bun run lint`
- `bun run test` (se existir script; caso contrário `bunx vitest run`)
- `bun run build`

Sem desativar regras ou testes. Sem mexer em lockfile a não ser que uma dep nova exija (não deve — tudo já está instalado).

## Detalhes técnicos

```text
Escopo do SW da PWA:      /            (arquivo /sw.js — gerado pelo VitePWA)
Escopo do SW do Firebase: /firebase-cloud-messaging-push-scope/  (arquivo /firebase-messaging-sw.js)
```

Tabela:
```sql
CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_id text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.fcm_tokens(user_id);
```
Grants + RLS + trigger `updated_at` inclusos na migration.

## Variáveis / secrets necessários
**Frontend (`.env`, opcionais — fallback já existe):**
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`

**Edge Function (já configurados; confirmar):**
- `FIREBASE_SERVICE_ACCOUNT` (JSON completo), `APP_URL`, `CRON_SECRET`/`CRON_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

## Passos manuais depois do merge
1. Após deploy, testar `enablePushNotifications` em desktop e mobile — confirmar duas rows em `fcm_tokens` com `device_id` distintos.
2. Enviar teste via `/admin` → confirmar que a notificação aparece **uma vez só** (sem duplicata).
3. Se quiser padronizar via env, adicionar as `VITE_FIREBASE_*` na Lovable.
4. Migration futura (fora deste escopo): remover linhas antigas de `user_preferences` com `preference_key = 'fcm_token'`.
