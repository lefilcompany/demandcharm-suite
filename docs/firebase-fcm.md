# Firebase FCM — configuração

Este documento descreve a configuração do novo Firebase para push
notifications. Não coloque valores reais aqui.

## Variáveis públicas (Lovable / Vite)

Cadastre as sete variáveis abaixo no ambiente de produção do Lovable
(`Project Settings → Environment`). Os valores devem ser idênticos aos
respectivos secrets já cadastrados no Supabase — a duplicação é necessária
porque secrets do Supabase não ficam acessíveis ao frontend Vite.

| Frontend (Lovable)                    | Secret equivalente (Supabase)     |
| ------------------------------------- | --------------------------------- |
| `VITE_FIREBASE_API_KEY`               | `FIREBASE_API_KEY`                |
| `VITE_FIREBASE_AUTH_DOMAIN`           | `FIREBASE_AUTH_DOMAIN`            |
| `VITE_FIREBASE_PROJECT_ID`            | `FIREBASE_PROJECT_ID`             |
| `VITE_FIREBASE_STORAGE_BUCKET`        | `FIREBASE_STORAGE_BUCKET`         |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`   | `FIREBASE_MESSAGING_SENDER_ID`    |
| `VITE_FIREBASE_APP_ID`                | `FIREBASE_APP_ID`                 |
| `VITE_FIREBASE_VAPID_KEY`             | `FIREBASE_VAPID_KEY`              |

O arquivo `.env.example` lista o mesmo conjunto de chaves com valores vazios.

## Secrets consumidos pelas Edge Functions

Esperados nas Edge Functions do Supabase:

- `FIREBASE_SERVICE_ACCOUNT` — JSON completo da service account (compactado).
- `FIREBASE_PROJECT_ID`
- `APP_URL`
- `CRON_SECRET` **ou** `CRON_TOKEN` (pelo menos um dos dois)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Os secrets públicos abaixo podem permanecer cadastrados no Supabase, mas o
backend atual não os utiliza — eles servem apenas como fonte-de-verdade
para os valores duplicados no Lovable:

- `FIREBASE_API_KEY`
- `FIREBASE_APP_ID`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_VAPID_KEY`

## Como o `firebase-config.generated.js` é produzido

`scripts/generate-firebase-config.mjs` roda automaticamente nos hooks
`predev` e `prebuild` do `package.json`. Ele:

1. Carrega variáveis dos arquivos `.env` do modo atual via `loadEnv` do Vite
   (respeitando `development`/`production`).
2. Mescla com `process.env` (variáveis do processo têm precedência).
3. Grava `public/firebase-config.generated.js` com os seis campos públicos.
4. Se qualquer variável obrigatória estiver ausente, grava
   `self.__FIREBASE_CONFIG__ = null;` — o push é desabilitado em runtime,
   mas o restante da aplicação continua funcionando.

O arquivo gerado nunca é commitado (está no `.gitignore`) e nunca contém
a VAPID key, service account ou qualquer secret.

## Comandos genéricos (Supabase CLI)

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='<JSON_COMPACTADO>'
supabase secrets set FIREBASE_PROJECT_ID='<PROJECT_ID>'
supabase secrets set APP_URL='<APP_URL>'
supabase secrets set CRON_SECRET='<SEGREDO_FORTE>'

supabase functions deploy send-push-notification
supabase functions deploy check-deadlines
```

`CRON_TOKEN` pode substituir `CRON_SECRET` quando já estiver configurado.
Não sobrescreva tokens de cron existentes.

## Validação dos quatro Firebase Project IDs

Os quatro valores abaixo precisam ser idênticos:

| Local           | Origem                                                    |
| --------------- | --------------------------------------------------------- |
| Frontend        | `import.meta.env.VITE_FIREBASE_PROJECT_ID`                |
| Service worker  | `self.__FIREBASE_CONFIG__.projectId` (gerado a partir de `VITE_FIREBASE_PROJECT_ID`) |
| Backend         | `Deno.env.get("FIREBASE_PROJECT_ID")`                     |
| Service account | `project_id` dentro de `FIREBASE_SERVICE_ACCOUNT`         |

`send-push-notification` já compara o `project_id` da service account com
`FIREBASE_PROJECT_ID` e aborta com `firebase_project_id_mismatch` se os
valores divergirem — sem registrar o JSON da service account em logs.

## Limpeza manual dos tokens antigos

**Não execute automaticamente.** Só depois de validar o novo fluxo em
produção.

Auditoria opcional:

```sql
SELECT
  COUNT(*)      AS total_tokens,
  MIN(created_at) AS token_mais_antigo,
  MAX(created_at) AS token_mais_recente
FROM public.fcm_tokens;
```

Fluxo legado (preferência antiga):

```sql
DELETE FROM public.user_preferences
WHERE preference_key = 'fcm_token';
```

Fluxo novo (tokens emitidos pelo Firebase anterior):

```sql
DELETE FROM public.fcm_tokens;
```

> A exclusão de `fcm_tokens` desativa o push em todos os dispositivos.
> Cada usuário precisará ativar novamente as notificações. Execute somente
> após confirmar que o frontend publicado já usa o novo Firebase.

## Testes de push sem expor credenciais

### 1. Registro do token no dispositivo
1. Publique as `VITE_FIREBASE_*` no Lovable.
2. Limpe service workers antigos no navegador de teste.
3. Faça login, abra **Configurações → Notificações** e ative.
4. Confirme a criação da linha em `fcm_tokens`:

```sql
SELECT user_id, device_id, LEFT(token, 8) AS token_prefix,
       created_at, last_used_at
FROM public.fcm_tokens
ORDER BY created_at DESC;
```

### 2. Envio pelo Firebase Console
Copie temporariamente o token completo, envie uma mensagem de teste apenas
para esse token pelo console do Firebase e valide a exibição única + o
clique abrindo a app. Não coloque o token em commits, issues ou prints.

### 3. Envio direto pela Edge Function
Use uma variável de ambiente — não escreva o segredo no comando:

```bash
read -s CRON_SECRET
export CRON_SECRET

curl -X POST \
  'https://<PROJECT_REF>.supabase.co/functions/v1/send-push-notification' \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H 'Content-Type: application/json' \
  -d '{
    "userIds": ["<USER_ID_DE_TESTE>"],
    "title": "Teste FCM",
    "body": "Notificação de teste",
    "link": "/"
  }'

unset CRON_SECRET
```

Substitua por `CRON_TOKEN` se for o segredo em uso.

### 4. Fluxo real
Dispare um evento que gere push (ou execute `check-deadlines` em ambiente
controlado) e valide os campos `sent`, `failed`, `skipped`, `blocked` e
`errors` nos logs sanitizados.
