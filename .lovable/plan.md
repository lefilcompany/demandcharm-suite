# Plano — Finalizar configuração do novo Firebase FCM

## Objetivo

Finalizar a configuração do novo Firebase para notificações push FCM, documentar corretamente as variáveis e secrets necessários, preparar a limpeza manual dos tokens do projeto anterior e garantir que frontend, service worker e backend utilizem o mesmo Firebase Project ID.

A implementação principal do FCM já foi realizada em turnos anteriores. Nada além do escopo de configuração, documentação e validação do push será alterado.

## Estado atual verificado

- ✅ `src/lib/firebase.ts` usa apenas `import.meta.env.VITE_FIREBASE_*`, valida a configuração, chama `isSupported()`, mantém instâncias em cache e não registra tokens completos.
- ✅ O service worker do Firebase é registrado em `/firebase-messaging-sw.js`, com escopo `/firebase-cloud-messaging-push-scope/`, separado do worker principal da PWA.
- ✅ `scripts/generate-firebase-config.mjs` gera `public/firebase-config.generated.js`, sem VAPID, service account ou secrets privados.
- ✅ `public/firebase-messaging-sw.js` carrega a configuração gerada, usa Firebase Compat `10.14.1` e não chama `showNotification()` manualmente.
- ✅ `send-push-notification` valida `serviceAccount.project_id === FIREBASE_PROJECT_ID`, normaliza links com `APP_URL`, aceita JWT, `CRON_SECRET` e `CRON_TOKEN`, e não registra tokens ou credenciais completas.
- ✅ `package.json` possui `predev` e `prebuild` chamando o gerador.
- ✅ `public/firebase-config.generated.js` está no `.gitignore`.

## Ajustes necessários

### 1. Criar `.env.example`

Criar o arquivo `.env.example` na raiz do projeto com as sete variáveis públicas vazias:

```env
# Firebase Web App — configuração pública
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=

```

Regras:

- Não inserir valores reais.
- Não inserir `FIREBASE_SERVICE_ACCOUNT`.
- Não inserir `CRON_SECRET`, `CRON_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY`.
- Não criar ou commitar `.env`, `.env.local` ou arquivos equivalentes com valores reais.
- Caso o arquivo já exista durante a implementação, preservar variáveis não relacionadas ao Firebase.

### 2. Ajustar o carregamento das variáveis pelo gerador

O script atual usa apenas `process.env`. Isso funciona quando o ambiente de build injeta as variáveis, mas pode gerar configuração nula no desenvolvimento local, porque o `predev` executa antes que o Vite carregue os arquivos `.env`.

Atualizar minimamente:

```text
scripts/generate-firebase-config.mjs
package.json

```

O gerador deve:

- Continuar priorizando variáveis já existentes em `process.env`.
- Carregar também os arquivos `.env` correspondentes ao modo atual.
- Usar `loadEnv` do Vite, que já está instalado.
- Não adicionar dependências.
- Gerar somente os seis campos públicos usados pelo service worker.
- Não incluir `VITE_FIREBASE_VAPID_KEY` no arquivo gerado.
- Não incluir service account, private key, cron secret ou qualquer secret privado.
- Continuar gerando `self.__FIREBASE_CONFIG__ = null` quando a configuração estiver incompleta.
- Não quebrar a aplicação quando as variáveis estiverem ausentes.

A precedência deve ser:

```text
Variáveis injetadas no processo
→ arquivos .env do modo atual
→ configuração ausente

```

Ajustar os scripts para informar o modo:

```json
{
  "generate:firebase-config": "node scripts/generate-firebase-config.mjs",
  "predev": "node scripts/generate-firebase-config.mjs development",
  "prebuild": "node scripts/generate-firebase-config.mjs production"
}

```

### 3. Criar documentação `docs/[firebase-fcm.md](http://firebase-fcm.md)`

Criar uma documentação curta, objetiva e sem valores reais.

A documentação deve conter:

#### Variáveis públicas necessárias no Lovable

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY

```

Informar que os valores devem ser os mesmos já cadastrados no Supabase:

```text
VITE_FIREBASE_API_KEY
← FIREBASE_API_KEY

VITE_FIREBASE_AUTH_DOMAIN
← FIREBASE_AUTH_DOMAIN

VITE_FIREBASE_PROJECT_ID
← FIREBASE_PROJECT_ID

VITE_FIREBASE_STORAGE_BUCKET
← FIREBASE_STORAGE_BUCKET

VITE_FIREBASE_MESSAGING_SENDER_ID
← FIREBASE_MESSAGING_SENDER_ID

VITE_FIREBASE_APP_ID
← FIREBASE_APP_ID

VITE_FIREBASE_VAPID_KEY
← FIREBASE_VAPID_KEY

```

Explicar que essa duplicação é necessária porque secrets do Supabase não ficam disponíveis para o frontend Vite.

#### Secrets realmente utilizados pelas Edge Functions

Documentar como necessários:

```text
FIREBASE_SERVICE_ACCOUNT
FIREBASE_PROJECT_ID
APP_URL
CRON_SECRET ou CRON_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY

```

Documentar que estes secrets públicos podem permanecer cadastrados no Supabase, mas não são utilizados diretamente pela Edge Function atual:

```text
FIREBASE_API_KEY
FIREBASE_APP_ID
FIREBASE_AUTH_DOMAIN
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_VAPID_KEY

```

Não remover ou renomear nenhum secret nesta entrega.

#### Comandos genéricos

Incluir apenas comandos com placeholders:

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='<JSON_COMPACTADO>'
supabase secrets set FIREBASE_PROJECT_ID='<PROJECT_ID>'
supabase secrets set APP_URL='<APP_URL>'
supabase secrets set CRON_SECRET='<SEGREDO_FORTE>'

supabase functions deploy send-push-notification
supabase functions deploy check-deadlines

```

Informar que `CRON_TOKEN` pode ser utilizado no lugar de `CRON_SECRET` quando já estiver configurado.

Não substituir automaticamente tokens de cron existentes.

### 4. Verificar `CRON_SECRET` e `CRON_TOKEN`

Usar `secrets--fetch_secrets` apenas se essa ferramenta estiver disponível no ambiente do Lovable.

A verificação deve:

- Consultar somente os nomes dos secrets.
- Não imprimir seus valores.
- Informar no relatório se existe:
  - apenas `CRON_SECRET`;
  - apenas `CRON_TOKEN`;
  - ambos;
  - nenhum.

Caso a ferramenta não esteja disponível:

- Não inventar o resultado.
- Informar que não foi possível confirmar pelo ambiente atual.
- Deixar a conferência como passo manual no painel do Supabase.

O código atual aceita qualquer um dos dois, mas `check-deadlines` falha quando nenhum está configurado.

### 5. Documentar a validação dos quatro Firebase Project IDs

A documentação deve informar que estes quatro valores precisam ser idênticos:

```text
Frontend:
VITE_FIREBASE_PROJECT_ID

Service worker:
self.__FIREBASE_CONFIG__.projectId

Backend:
FIREBASE_PROJECT_ID

Service account:
project_id dentro de FIREBASE_SERVICE_ACCOUNT

```

A origem de cada valor deve ser explicada:

- O frontend lê `VITE_FIREBASE_PROJECT_ID`.
- O arquivo `firebase-config.generated.js` é gerado a partir da mesma variável.
- A Edge Function lê `FIREBASE_PROJECT_ID`.
- O JSON da service account contém `project_id`.

A Edge Function já interrompe o envio com erro seguro quando o ID do secret e o ID da service account não coincidem.

Não registrar os valores completos em logs de produção.

### 6. Documentar a limpeza manual dos tokens antigos

Não executar nenhum `DELETE` automaticamente.

A documentação deve separar os dois casos.

#### Tokens do fluxo legado

Depois que o novo fluxo estiver validado:

```sql
DELETE FROM public.user_preferences
WHERE preference_key = 'fcm_token';

```

#### Tokens da tabela nova gerados pelo Firebase anterior

Primeiro, oferecer uma consulta de auditoria:

```sql
SELECT
  COUNT(*) AS total_tokens,
  MIN(created_at) AS token_mais_antigo,
  MAX(created_at) AS token_mais_recente
FROM public.fcm_tokens;

```

Caso a tabela contenha tokens gerados antes da troca do Firebase, a limpeza manual poderá ser:

```sql
DELETE FROM public.fcm_tokens;

```

Adicionar um aviso:

```text
A exclusão de fcm_tokens desativa o push em todos os dispositivos.
Cada usuário precisará ativar novamente as notificações.
Execute somente depois de confirmar que o frontend publicado já usa o novo Firebase.

```

Não transformar essas exclusões em migration automática.

### 7. Documentar os testes corretos

Não utilizar `/admin/email-test` como teste de push, pois essa tela chama somente `send-test-email` e valida o Resend.

#### Teste 1 — ativação e registro do token

1. Publicar as variáveis `VITE_FIREBASE_*`.
2. Limpar os service workers antigos no navegador de teste.
3. Fazer login.
4. Abrir **Configurações → Notificações**.
5. Ativar notificações do navegador.
6. Confirmar a criação de uma row em `fcm_tokens`.

Consulta:

```sql
SELECT
  user_id,
  device_id,
  LEFT(token, 8) AS token_prefix,
  created_at,
  last_used_at
FROM public.fcm_tokens
ORDER BY created_at DESC;

```

#### Teste 2 — envio pelo Firebase Console

1. Copiar temporariamente o token completo do dispositivo de teste.
2. Usar a opção de mensagem de teste do Firebase Console.
3. Enviar somente para esse token.
4. Confirmar que a notificação aparece apenas uma vez.
5. Confirmar que o clique abre a aplicação.

Não colocar o token em documentação, commit, issue ou screenshot.

#### Teste 3 — envio pela Edge Function

Documentar uma chamada usando variável de ambiente, sem colocar o secret diretamente no comando:

```bash
read -s CRON_SECRET
export CRON_SECRET

curl -X POST \
  'https://<PROJECT_REF>.supabase.co/functions/v1/send-push-notification' \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "<USER_ID_DE_TESTE>",
    "title": "Teste FCM",
    "body": "Notificação de teste",
    "link": "/"
  }'

unset CRON_SECRET

```

Caso o ambiente utilize `CRON_TOKEN`, usar uma variável equivalente.

#### Teste 4 — fluxo real

Após o teste direto:

- Executar um evento real que já dispare push.
- Ou executar `check-deadlines` em ambiente controlado.
- Verificar os logs sanitizados.
- Confirmar os campos:
  - `sent`;
  - `failed`;
  - `skipped`;
  - `blocked`;
  - `errors`.

### 8. Validação da CI

Executar:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build

```

Regras:

- Corrigir apenas erros reais.
- Não usar `@ts-ignore`.
- Não usar `@ts-nocheck`.
- Não desativar regras de lint ou TypeScript.
- Não remover ou ignorar testes.
- Não alterar o lockfile sem dependência nova.
- Não encerrar enquanto algum comando falhar.

Depois do build, executar:

```bash
git status --short

```

Confirmar que:

- `public/firebase-config.generated.js` não aparece para commit.
- Nenhum `.env` real foi criado.
- Nenhum secret foi incluído no repositório.
- Não existem alterações fora do escopo.

## Arquivos previstos

### Criar

```text
.env.example
docs/firebase-fcm.md

```

### Alterar somente se necessário

```text
scripts/generate-firebase-config.mjs
package.json

```

As alterações nesses dois arquivos devem ser limitadas ao carregamento correto dos arquivos `.env` por modo.

## Fora do escopo

Não alterar funcionalmente:

```text
src/lib/firebase.ts
public/firebase-messaging-sw.js
supabase/functions/send-push-notification/index.ts
supabase/functions/check-deadlines/index.ts

```

Não alterar:

- `/sw.js` da PWA;
- tabela `fcm_tokens`;
- políticas RLS;
- RPC de registro do token;
- listener foreground;
- lógica de logout;
- credenciais do Google Cloud;
- nomes ou valores dos secrets;
- tokens antigos no banco.

## Relatório final

O relatório deve incluir:

- Arquivos criados.
- Arquivos alterados.
- Como o gerador carrega variáveis do processo e arquivos `.env`.
- Como `firebase-config.generated.js` é produzido.
- Quais `VITE_FIREBASE_*` ainda precisam ser cadastradas no Lovable.
- Quais secrets são realmente consumidos pelo backend.
- Quais secrets públicos estão cadastrados no Supabase, mas não são consumidos pelo backend.
- Presença de `CRON_SECRET` e/ou `CRON_TOKEN`, sem mostrar valores.
- Como os quatro Firebase Project IDs são validados.
- Resultado de `npm ci`.
- Resultado de `npm run typecheck`.
- Resultado de `npm run lint`.
- Resultado de `npm run test`.
- Resultado de `npm run build`.
- Resultado de `git status --short`.
- Passos manuais restantes para testar o push sem expor credenciais.
- &nbsp;