# Plano — Corrigir notificações push via FCM

## Objetivo

Corrigir o fluxo de notificações push do SoMA, garantindo:

- ausência de conflito entre o service worker da PWA e o service worker do Firebase;
- configuração Firebase consistente entre frontend e service worker;
- suporte a vários dispositivos por usuário;
- sincronização e renovação dos tokens FCM;
- remoção segura de tokens inválidos;
- nenhuma notificação duplicada;
- listener de foreground ativo em toda a área autenticada;
- proteção contra tokens vinculados à conta errada;
- CI completamente verde.

Não alterar funcionalidades fora do escopo de push notifications.

---

## 1. Configuração pública do Firebase

Atualmente, os dados do Firebase estão hardcoded em:

- `src/lib/firebase.ts`;
- `public/firebase-messaging-sw.js`.

Eliminar essa duplicação.

### Criar

```text
scripts/generate-firebase-config.mjs

```

Esse script deve gerar:

```text
public/firebase-config.generated.js

```

Com o formato:

```javascript
self.__FIREBASE_CONFIG__ = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

```

Regras:

- usar somente as variáveis `VITE_FIREBASE_*`;
- não incluir VAPID nesse arquivo;
- não incluir service account ou qualquer segredo;
- adicionar o arquivo gerado ao `.gitignore`;
- se as variáveis não existirem, gerar `self.__FIREBASE_CONFIG__ = null`;
- não falhar o build da CI pela ausência das variáveis;
- em produção, o FCM deve ficar desativado com erro claro caso a configuração esteja incompleta;
- não usar fallback silencioso para o projeto Firebase antigo.

Adicionar scripts:

```json
{
  "generate:firebase-config": "node scripts/generate-firebase-config.mjs",
  "predev": "npm run generate:firebase-config",
  "prebuild": "npm run generate:firebase-config"
}

```

Não adicionar dependências novas se não forem necessárias.

---

## 2. `public/firebase-messaging-sw.js`

Manter como service worker clássico, sem ES modules.

Alterações:

1. Carregar primeiro:

```javascript
importScripts("/firebase-config.generated.js");

```

2. Validar `self.__FIREBASE_CONFIG__`. Se estiver ausente, registrar uma mensagem curta e não inicializar o Firebase.
3. Atualizar os imports Firebase Compat para `10.14.1`, mesma versão do pacote instalado:

```javascript
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

```

4. Inicializar o Firebase somente uma vez.
5. Manter `onBackgroundMessage` apenas para logging sanitizado:

```javascript
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Background message received", {
    type: payload?.data?.type,
    notificationType: payload?.data?.notificationType,
  });
});

```

6. Não executar `self.registration.showNotification()`, pois o backend envia payload `notification` e o FCM já realiza a exibição em background.
7. Remover o handler personalizado atual de `notificationclick`. A navegação deve usar exclusivamente:

```text
message.webpush.fcm_options.link

```

8. Manter `notificationclose`, `install`, `skipWaiting`, `activate` e `clients.claim()`, sem tentar controlar páginas fora do escopo do worker.

---

## 3. `src/lib/firebase.ts`

Transformar a inicialização em lazy e segura.

### Configuração

Ler:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY

```

Validar todos os campos antes de chamar `initializeApp`.

Não usar valores antigos como fallback em produção. Configuração incompleta deve apenas deixar o push indisponível, sem derrubar a aplicação.

### Firebase App e Messaging

- usar `getApps()` e `getApp()` para impedir inicialização duplicada;
- manter uma única instância de `Messaging`;
- chamar `isSupported()` antes de `getMessaging()`;
- não inicializar Messaging em SSR, navegador incompatível ou contexto inseguro.

### Service worker

Registrar:

```text
Arquivo: /firebase-messaging-sw.js
Escopo: /firebase-cloud-messaging-push-scope/

```

Regras:

- procurar primeiro um registro existente com `navigator.serviceWorker.getRegistration()`;
- registrar somente se não existir;
- aguardar a ativação do registro específico;
- não usar `navigator.serviceWorker.ready`, pois ele pode retornar o `/sw.js` da PWA;
- passar exatamente o registro do Firebase ao `getToken()`.

### Retorno estruturado

Em vez de retornar somente `null`, retornar um resultado tipado:

```typescript
type PushRegistrationResult =
  | {
      ok: true;
      token: string;
      registration: ServiceWorkerRegistration;
    }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "insecure-context"
        | "permission-denied"
        | "missing-config"
        | "service-worker-error"
        | "token-error";
      error?: string;
    };

```

### Exportações

Disponibilizar:

```typescript
requestNotificationPermission()
getCurrentFcmToken()
subscribeToForegroundMessages()
deleteFcmToken()

```

`getCurrentFcmToken()` deve obter ou atualizar o token sem solicitar novamente a permissão quando ela já estiver concedida.

Nunca registrar o token completo. Usar somente:

```typescript
`${token.slice(0, 6)}…`

```

---

## 4. Migration `public.fcm_tokens`

Criar uma migration SQL autocontida.

### Tabela

```sql
CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_id text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fcm_tokens_token_key UNIQUE (token),
  CONSTRAINT fcm_tokens_user_device_key UNIQUE (user_id, device_id)
);

```

Criar índice para:

```sql
CREATE INDEX fcm_tokens_user_id_idx
ON public.fcm_tokens(user_id);

```

### Trigger

Não depender de uma função de trigger que talvez não exista.

Criar uma função específica e autocontida para atualizar `updated_at`, por exemplo:

```text
public.set_fcm_tokens_updated_at()

```

Adicionar o trigger correspondente.

### RLS

Ativar RLS.

Criar políticas explícitas para `authenticated`:

- SELECT: `auth.uid() = user_id`;
- INSERT: `auth.uid() = user_id`;
- UPDATE: `auth.uid() = user_id`;
- DELETE: `auth.uid() = user_id`.

Usar `USING` e `WITH CHECK` corretamente.

Conceder:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.fcm_tokens
TO authenticated;

GRANT ALL
ON public.fcm_tokens
TO service_role;

```

Não criar política RLS desnecessária para `service_role`.

### Registro atômico do token

Criar uma RPC segura:

```text
public.register_fcm_token(
  p_token text,
  p_device_id text,
  p_user_agent text
)

```

Requisitos:

- `SECURITY DEFINER`;
- `SET search_path = ''`;
- usar obrigatoriamente `auth.uid()`;
- rejeitar chamadas sem usuário autenticado;
- remover qualquer vínculo anterior do mesmo token;
- remover o token anterior do mesmo `(user_id, device_id)`;
- inserir o vínculo atual;
- nunca aceitar `user_id` enviado pelo cliente;
- revogar execução de `PUBLIC` e `anon`;
- conceder execução apenas a `authenticated`.

Isso evita que o mesmo navegador continue associado a uma conta anterior.

Não migrar automaticamente `user_preferences.fcm_token`.

---

## 5. Atualizar os tipos do Supabase

Depois da migration, atualizar:

```text
src/integrations/supabase/types.ts

```

Usar o comando de geração de tipos do projeto Supabase ou atualizar o arquivo de forma equivalente.

A tabela `fcm_tokens` e a RPC `register_fcm_token` devem aparecer nos tipos antes de alterar os hooks.

Não usar `as any` para contornar os tipos.

---

## 6. `src/hooks/usePushNotifications.ts`

### Identificação do dispositivo

Gerar um identificador estável em:

```text
localStorage["soma:fcm_device_id"]

```

Usar `crypto.randomUUID()`.

O identificador deve permanecer entre sessões do mesmo navegador.

### Carregamento

Consultar `fcm_tokens` por:

```text
user_id + device_id

```

Usar `.maybeSingle()`.

Propagar e tratar todos os erros de:

- select;
- RPC;
- insert;
- update;
- delete.

### Ativação

Fluxo:

1. validar suporte;
2. solicitar permissão;
3. obter token usando o service worker correto;
4. chamar `register_fcm_token`;
5. salvar `user_agent` e `last_used_at`;
6. atualizar o estado local;
7. somente então mostrar sucesso.

Não mostrar sucesso se o token foi criado no Firebase, mas não foi registrado no Supabase.

### Sincronização e rotação

Quando existir uma row para o dispositivo e a permissão estiver `granted`:

1. chamar `getCurrentFcmToken()` sem novo prompt;
2. comparar com o token salvo;
3. registrar novamente pela RPC se o token mudou;
4. atualizar `last_used_at`.

Não registrar automaticamente um dispositivo que não possua row e cujo usuário não tenha ativado push explicitamente.

### Desativação

Fluxo:

1. excluir a row apenas do `user_id + device_id`;
2. chamar `deleteFcmToken()`;
3. limpar o estado local;
4. mostrar sucesso somente quando o vínculo no servidor tiver sido removido.

Se `deleteFcmToken()` falhar depois que a row foi apagada, considerar o push desativado no servidor e registrar apenas um aviso sanitizado.

### Estado

Definir:

```typescript
isEnabled =
  permissionStatus === "granted" &&
  existeTokenDoDispositivoAtual;

```

Remover completamente o listener foreground deste hook.

---

## 7. Limpeza no logout

Atualizar a implementação central de `signOut` em `src/lib/auth.tsx`.

Antes de limpar `user`, `session` e chamar `supabase.auth.signOut()`:

1. realizar uma limpeza best-effort do token do dispositivo atual;
2. apagar a row do usuário/dispositivo;
3. chamar `deleteFcmToken()`;
4. não bloquear o logout caso a limpeza falhe;
5. nunca executar essa limpeza depois que a sessão já tiver sido descartada.

Essa alteração faz parte do escopo push e evita notificações da conta anterior em navegadores compartilhados.

Não colocar essa lógica somente no botão visual de logout. Ela deve estar na função central `signOut()`.

---

## 8. Listener foreground global

Criar:

```text
src/hooks/useForegroundPushListener.ts

```

O hook deve:

- registrar `onMessage` apenas quando houver usuário autenticado;
- chamar a função assíncrona `subscribeToForegroundMessages()`;
- retornar o unsubscribe no cleanup;
- impedir listener duplicado em remounts;
- não pedir permissão;
- mostrar toast com título, corpo e ação “Ver”;
- normalizar links relativos com `window.location.origin`;
- rejeitar protocolos diferentes de `http:` e `https:`;
- não navegar para origem externa não autorizada.

Montar o hook uma única vez em:

```text
src/components/ProtectedLayout.tsx

```

Pode ser chamado diretamente no início do componente `ProtectedLayout`.

Não montar esse listener dentro da tela de configurações.

---

## 9. `send-push-notification`

Manter:

- FCM HTTP v1;
- autenticação por JWT do usuário;
- `CRON_SECRET`;
- `CRON_TOKEN`;
- validação de equipes existente.

### Ordem do processamento

Reorganizar para:

1. autenticar;
2. validar request;
3. calcular usuários autorizados;
4. buscar preferências;
5. buscar tokens;
6. filtrar usuários que desativaram push;
7. retornar cedo se não houver tokens;
8. validar Firebase;
9. gerar access token;
10. enviar as mensagens.

Não gerar access token do Google quando não houver nenhum push a enviar.

### Tokens

Ler:

```sql
SELECT id, user_id, token, device_id
FROM public.fcm_tokens
WHERE user_id IN (...)

```

Não usar mais `user_preferences.fcm_token`.

Um usuário pode gerar vários envios, um para cada dispositivo registrado.

### Service account

Validar:

```text
client_email
private_key
project_id

```

Adicionar também o secret:

```text
FIREBASE_PROJECT_ID

```

Antes do envio, exigir:

```text
serviceAccount.project_id === FIREBASE_PROJECT_ID

```

Se forem diferentes, interromper toda a operação com erro de configuração sanitizado. Não enviar e não excluir tokens.

Nunca registrar ou retornar:

- JSON da service account;
- private key;
- JWT assinado;
- access token;
- resposta bruta que contenha credenciais.

### Link

Usar:

```typescript
new URL(link || "/", APP_URL)

```

Regras:

- `APP_URL` deve ser uma URL absoluta;
- links relativos devem ser resolvidos contra `APP_URL`;
- aceitar somente `https:`;
- aceitar `http:` somente em localhost;
- aceitar apenas a mesma origem de `APP_URL`;
- link inválido ou externo deve cair para a raiz de `APP_URL`.

Enviar a URL final em:

```text
message.webpush.fcm_options.link

```

### Payload

Continuar enviando:

```text
message.notification
message.webpush.notification
message.webpush.fcm_options.link
message.data

```

Garantir que todos os valores de `[message.data](http://message.data)` sejam strings.

### Erros FCM

Fazer parse JSON da resposta HTTP v1.

Classificar o erro usando:

```text
error.status
error.details[].@type
error.details[].errorCode
error.details[].fieldViolations

```

Remover token somente quando:

- o detalhe FCM tiver `errorCode === "UNREGISTERED"`;
- ou houver `INVALID_ARGUMENT` especificamente identificado como token de registro inválido.

Não remover token apenas porque:

- o status é `NOT_FOUND`;
- o status é `INVALID_ARGUMENT`;
- existe erro em outro campo do payload;
- ocorreu `SENDER_ID_MISMATCH`;
- ocorreu erro de autenticação ou permissão.

Erros de projeto, credencial ou sender devem ser tratados como configuração global, sem exclusão em massa.

Excluir tokens inválidos por:

```text
token

```

Nunca por `user_id`.

### Resposta

Retornar:

```typescript
{
  success: failed === 0,
  sent: number,
  failed: number,
  skipped: number,
  blocked: number,
  errors: Array<{
    userId: string;
    deviceId: string;
    code: string;
  }>;
}

```

Não retornar token FCM completo nem mensagem bruta do Google.

Usar HTTP 200 para resultado processado com falhas individuais e HTTP 500 apenas para erro global de configuração ou execução.

---

## 10. `supabase/config.toml`

Confirmar e preservar:

```toml
[functions.check-deadlines]
verify_jwt = false

[functions.send-push-notification]
verify_jwt = false

```

Não alterar outras funções.

Não remover as validações internas por JWT, `CRON_SECRET` ou `CRON_TOKEN`.

---

## 11. Testes

Adicionar ou atualizar testes para cobrir:

- configuração Firebase incompleta;
- inicialização única;
- link relativo normalizado;
- link externo rejeitado;
- erro `UNREGISTERED`;
- `INVALID_ARGUMENT` de payload sem remoção do token;
- `INVALID_ARGUMENT` especificamente relacionado ao token;
- vários tokens para o mesmo usuário;
- preferência de push desativada;
- exclusão de somente um dispositivo;
- resposta com `blocked`;
- não vazamento de tokens ou credenciais;
- listener foreground com cleanup.

Extrair funções puras da Edge Function quando necessário para facilitar testes, sem usar APIs Node incompatíveis com Deno.

---

## 12. CI e validação técnica

O projeto usa npm e possui `package-lock.json`.

Executar exatamente:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build

```

Não usar `bunx tsgo`.

Não desativar regras de lint, TypeScript ou testes.

Não adicionar `@ts-ignore`, `@ts-nocheck` ou casts genéricos para esconder erros.

Não modificar o lockfile, exceto se uma dependência realmente for adicionada. A implementação não deve exigir dependência nova.

Não encerrar a tarefa até todos os comandos estarem verdes.

---

## 13. Variáveis necessárias

### Frontend e geração do service worker

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY

```

### Supabase Edge Function

```text
FIREBASE_SERVICE_ACCOUNT
FIREBASE_PROJECT_ID
APP_URL
CRON_SECRET ou CRON_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY

```

Nunca colocar `FIREBASE_SERVICE_ACCOUNT` em variável `VITE_*`, arquivo público ou commit.

---

## 14. Validação manual após deploy

1. Limpar service workers e dados antigos do site no navegador de teste.
2. Ativar push em um desktop.
3. Ativar push em outro navegador ou dispositivo.
4. Confirmar duas rows com `device_id` diferentes em `fcm_tokens`.
5. Confirmar que o mesmo usuário recebe em ambos os dispositivos.
6. Confirmar que a notificação em background aparece apenas uma vez.
7. Confirmar toast em foreground fora da tela de configurações.
8. Confirmar que o clique abre a URL enviada.
9. Desativar um dispositivo e confirmar que o outro permanece registrado.
10. Fazer logout e confirmar que a row do dispositivo foi removida.
11. Entrar com outra conta no mesmo navegador e confirmar que o token não permanece associado à conta anterior.
12. Simular token `UNREGISTERED` e confirmar exclusão somente desse token.
13. Simular erro de payload e confirmar que nenhum token válido é apagado.
14. Executar o envio de teste administrativo.
15. Executar o fluxo de lembretes de prazo por `check-deadlines`.

---

## 15. Fora do escopo desta entrega

Não apagar automaticamente as entradas antigas:

```sql
user_preferences.preference_key = 'fcm_token'

```

Ao final, apenas documentar uma migration futura para removê-las depois que o fluxo com `fcm_tokens` estiver validado em produção.

---

## Entrega final esperada

Ao concluir, informar:

- arquivos criados e alterados;
- nome da migration;
- políticas RLS e RPC criadas;
- como a configuração chegou ao service worker;
- alteração realizada no logout;
- variáveis necessárias no Lovable;
- secrets necessários no Supabase;
- resultado de cada comando da CI;
- testes manuais ainda pendentes;
- confirmação de que nenhuma funcionalidade fora do push foi alterada.
- &nbsp;