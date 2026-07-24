## Diagnóstico

O toast genérico "Erro ao ativar notificações push" no `/admin/push-test` cai no `default` do `switch(result.reason)` em `src/hooks/usePushNotifications.ts` (linha ~207). Isso significa que `requestNotificationPermission()` retornou `{ ok: false, reason: <valor não mapeado> }` **ou** lançou uma exceção capturada pelo `catch` externo.

Do que já verifiquei:

- **Secrets FCM cadastrados** — as 7 variáveis públicas estão presentes no Supabase, além de `FIREBASE_SERVICE_ACCOUNT`.
- **Edge Function `firebase-public-config`** — retorna `200` com todos os campos (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `vapidKey`) do projeto `somaproject-489110`. Ou seja, `configStatus` deveria virar `ready` no deploy.
- **Service worker** (`public/firebase-messaging-sw.js`) aceita config via query string, então a ausência de `VITE_*` no build não quebra o SW.

Isso descarta as causas mais comuns (config ausente/SW mal registrado). Sobram três hipóteses fortes (ordenadas por probabilidade), todas dependentes de dados que só o navegador do deploy revela:

1. **`token-error` da API do FCM** — restrição no *API key* do Google Cloud (referers HTTP autorizados) impedindo `getToken` a partir de `demandcharm-suite.lovable.app` / `pla.soma.lefil.com.br`. É a causa mais comum quando a config está OK mas o token não sai.
2. **`service-worker-error` de ativação** — o PWA existente (Workbox) pode estar interferindo no registro do `/firebase-cloud-messaging-push-scope/` e estourando o timeout de 15s.
3. **Permissão do navegador negada previamente** (estado `denied`), fazendo `Notification.requestPermission()` resolver sem prompt.

O log real está no console do deploy (`[FCM] …`, `[push] …`), mas nenhum foi capturado ainda porque a ativação foi feita em outra aba.

## Plano de correção

### Etapa 1 — Instrumentar para capturar o motivo exato

Sem o console do deploy, corrigir às cegas é chute. Vou:

1. Trocar o `toast.error("Erro ao ativar notificações push")` genérico por mensagens específicas para cada `reason`, incluindo o campo `error` retornado (ex.: `messaging/permission-blocked`, `messaging/failed-service-worker-registration`, `messaging/token-subscribe-failed`).
2. Adicionar um bloco de diagnóstico visível no card do `AdminProfile` / `/admin/push-test` mostrando: `permissionStatus`, `configStatus`, `configSource`, `configMissing[]`, `isSecureContext`, `serviceWorker.controller?.scriptURL`, último `reason` e último `error` técnico.
3. Logar em `console.error` o payload completo `{reason, error}` antes de exibir o toast.

Com isso, na próxima tentativa você já saberá qual das 3 hipóteses é a real, sem precisar abrir DevTools.

### Etapa 2 — Corrigir conforme o motivo revelado

- **Se `token-error` com `messaging/token-subscribe-failed` ou `403`:** liberar restrições da API key no Google Cloud Console (Credentials → API key do web app → *Website restrictions*: adicionar `demandcharm-suite.lovable.app`, `pla.soma.lefil.com.br` e o preview `*.lovable.app`). Esse ajuste é fora do código; vou te mandar o passo a passo.
- **Se `service-worker-error`:** ampliar o timeout de ativação, garantir `updateViaCache: "none"` (já está) e forçar `registration.update()` antes de aguardar `active`. Também vou detectar controlador Workbox e desregistrá-lo apenas no escopo `/firebase-cloud-messaging-push-scope/` para evitar conflito.
- **Se `permission-denied`:** melhorar o card com instruções e um botão para abrir `chrome://settings/content/notifications` (Chrome) e equivalente no Safari/Edge.

### Etapa 3 — Validar

1. Refazer o teste no deploy (`/admin/push-test`) e verificar o novo painel de diagnóstico.
2. Enviar um push de teste pela função `send-push-notification` e confirmar entrega em foreground e background.
3. Rechecar que o token foi gravado em `public.fcm_tokens`.

## Perguntas técnicas / dependências externas

- **Domínios autorizados no Firebase Console** — em *Project settings → General → Your apps (Web)*, confirmar que `demandcharm-suite.lovable.app` e `pla.soma.lefil.com.br` estão listados. Se não estiverem, precisa adicionar.
- **Restrições da API key** (Google Cloud Console → APIs & Services → Credentials → Web API key) — precisa liberar os mesmos domínios se estiver marcada como "HTTP referrers".

Não preciso de nenhum secret novo — a config está completa. Só possivelmente ajustes nos consoles do Firebase/Google Cloud, dependendo do resultado da Etapa 1.

## Detalhes técnicos (arquivos)

- `src/hooks/usePushNotifications.ts` — mensagens de toast por `reason`, logging estruturado.
- `src/pages/admin/AdminPushTest.tsx` (e card em `src/pages/admin/AdminProfile.tsx`) — painel de diagnóstico com o estado atual.
- `src/lib/firebase.ts` — se cair na hipótese 2, ajustes em `getOrRegisterFcmSw` / `waitForExpectedActive`.

Nenhuma mudança de banco, de RLS ou de secrets nesta etapa.