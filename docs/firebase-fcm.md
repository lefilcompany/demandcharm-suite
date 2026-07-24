# Firebase FCM — configuração

Este documento descreve a configuração de push notifications. Não coloque valores reais aqui.

## Fonte única da configuração pública

O frontend não usa mais `VITE_FIREBASE_*` nem arquivo gerado em build. A configuração pública vem em runtime da função `firebase-public-config`, que lê os secrets `FIREBASE_*` e retorna somente campos públicos do Firebase Web App.

Fluxo atual:

```text
firebase-public-config
→ frontend recebe config pública + VAPID
→ frontend registra /firebase-messaging-sw.js com a config na query string
→ getToken() usa a mesma config e a mesma VAPID
→ token é salvo em fcm_tokens
```

## Secrets necessários no backend

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_VAPID_KEY`
- `FIREBASE_SERVICE_ACCOUNT` — JSON completo da service account, compactado.
- `APP_URL`
- `CRON_SECRET` ou `CRON_TOKEN`

Os campos públicos acima são seguros para o navegador, mas continuam centralizados como secrets runtime para evitar duplicação no build.

## Compatibilidade obrigatória do projeto Firebase

Estes valores precisam pertencer ao mesmo projeto Firebase:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_VAPID_KEY`
- `project_id` dentro de `FIREBASE_SERVICE_ACCOUNT`

A tela `/admin/push-test` mostra fingerprints seguros: `projectId`, final do sender ID, início do app ID, hash curto da VAPID e se a service account está compatível. Ela nunca mostra service account, chave privada ou valores completos sensíveis.

## Service workers

- PWA: permanece no escopo `/`.
- FCM: usa somente `/firebase-cloud-messaging-push-scope/`.
- Registros antigos de `firebase-messaging-sw.js` no escopo `/` ou sem query string de configuração são removidos automaticamente.
- O botão “Resetar registro FCM” limpa apenas registros FCM e a inscrição push associada; não remove o worker principal da PWA.

## Fluxo de token

O fluxo normal não cancela inscrição válida:

```text
carregar config runtime
→ registrar/reutilizar SW FCM
→ getToken()
→ salvar token
```

Somente se `getToken()` falhar por erro real de inscrição push, o app faz uma recuperação controlada:

```text
deleteToken()
→ unsubscribe da PushSubscription como fallback
→ unregister de workers FCM antigos
→ registrar SW FCM novo
→ getToken() uma única vez novamente
```

## Validação rápida

1. Abra `/admin/push-test` em um perfil novo do Chrome/Edge.
2. Confirme `Config FCM: ready`.
3. Confirme apenas um registro FCM em `/firebase-cloud-messaging-push-scope/` e `Config runtime: sim`.
4. Clique em “Ativar notificações neste dispositivo”.
5. Recarregue a página e confirme que o token continua ativo sem recriação agressiva.
6. Envie um teste e valide `sent: 1` quando houver dispositivo elegível.

Se aparecer `push-subscribe-failed`, use “Resetar registro FCM” uma vez e tente ativar novamente. Se aparecer `vapid-invalid` ou service account incompatível, revise o projeto Firebase e a chave VAPID no console do Firebase.
