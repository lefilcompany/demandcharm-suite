## Diagnóstico

O erro `Registration failed - push service error` vem do `pushManager.subscribe()` do navegador (não é bug do backend). Nas suas condições — VAPID key trocada recentemente + service worker/registro já cadastrados anteriormente — a causa quase certa é:

**Existe um `PushSubscription` cacheado no navegador vinculado à VAPID key antiga.** O Chrome/Firefox recusa reassinar com uma `applicationServerKey` diferente sem antes cancelar a inscrição anterior. Como o `getToken()` do Firebase reutiliza a subscription existente quando encontra uma, ele repassa a recusa do push service como `token-error`.

Secundariamente, também é possível que exista um SW `firebase-messaging-sw.js` registrado em outro scope (raiz `/`) com config antiga, competindo com o scope oficial `/firebase-cloud-messaging-push-scope/`.

O código atual em `src/lib/firebase.ts` só reutiliza o registration existente — nunca força `unsubscribe()` do push manager nem `deleteToken()` antes de pedir um novo token. Por isso o "Clear site data" manual resolveria, mas dentro do fluxo normal do app o erro persiste.

## Plano de correção

### 1. `src/lib/firebase.ts` — fluxo de reset defensivo
- Nova função interna `resetPushSubscription(registration)` que:
  - Chama `registration.pushManager.getSubscription()` e, se existir, `subscription.unsubscribe()`.
  - Chama `deleteToken(messaging)` para limpar o IndexedDB do Firebase Messaging.
- Nova função interna `cleanupStaleFcmRegistrations(expectedScriptUrl)` que percorre `navigator.serviceWorker.getRegistrations()` e desregistra qualquer worker `firebase-messaging-sw.js` cujo `scriptURL` não bata com o esperado (limpa registros de scope `/` ou com querystring antigo).
- Em `requestNotificationPermission()`:
  - Após obter o `registration`, chamar `cleanupStaleFcmRegistrations` e `resetPushSubscription` **antes** do primeiro `getToken`.
  - Se `getToken` falhar com `messaging/token-subscribe-failed`, `push-service-error` ou `Registration failed`, executar `resetPushSubscription` novamente e retentar uma vez. Só devolver `token-error` após o retry.
- Exportar `resetPushRegistration()` público que faz o hard-reset (unsubscribe + deleteToken + unregister do SW FCM) para o botão da UI.

### 2. `src/hooks/usePushNotifications.ts` — expor reset
- Adicionar `resetPushRegistration` retornado pelo hook, que chama a nova função de `firebase.ts`, limpa `fcm_tokens` desse `device_id` no banco, zera `fcmToken`/`lastError` e mostra toast de sucesso. Não pede permissão de novo — só limpa estado.

### 3. `src/pages/admin/AdminPushTest.tsx` — botão "Resetar registro FCM"
- Adicionar botão secundário ao lado do "Ativar notificações neste dispositivo" que dispara `resetPushRegistration()` e, em seguida, executa novamente `enablePushNotifications()`.
- Mostrar no painel de diagnóstico o `scriptURL` do SW ativo (para confirmar visualmente que só existe um registro correto).

### 4. Validação
- Build automático do dev server confirma tipagem.
- Não há como automatizar o teste do push service via Playwright em modo headless (o serviço FCM real requer usuário logado no browser); o critério de aceite é: usuário clica em "Resetar registro FCM" → clica em "Ativar" → toast de sucesso e `fcm_token` gravado.

## Detalhes técnicos

- `pushManager.unsubscribe()` retorna `true` mesmo quando não havia subscription; é seguro chamar sempre.
- `deleteToken()` do `firebase/messaging` remove o registro do IndexedDB do FCM; sem isso, o SDK retorna o mesmo token cacheado mesmo com subscription nova.
- Não altero o `firebase-messaging-sw.js` — ele já lê config da querystring, o que garante que qualquer novo registro traga o config atualizado.
- Não mexo em secrets nem no `.env`; as chaves já publicadas continuam válidas.

## O que NÃO faço

- Não removo/troco a VAPID key (a atual já foi validada no console do Firebase).
- Não altero as edge functions `send-push-notification` / `firebase-public-config`.
- Não instruí o usuário a "Clear site data" manualmente — o botão de reset faz isso programaticamente.
