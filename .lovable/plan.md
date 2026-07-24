## Objetivo
Fazer o push FCM funcionar de forma estável, seguindo a lógica simples do projeto original SOMA+: registrar/reutilizar o service worker, chamar `getToken()` sem reset obrigatório e usar reset apenas como recuperação quando houver erro real de inscrição.

## Plano de implementação

1. **Simplificar a fonte de configuração Firebase**
   - Manter a configuração pública vindo da função `firebase-public-config` em runtime.
   - Remover do fluxo normal a dependência de `VITE_FIREBASE_*`, `firebase-config.generated.js`, script gerador e plugin Vite de Firebase.
   - Atualizar a documentação para refletir que não é necessário duplicar secrets como variáveis Vite.

2. **Corrigir o service worker FCM**
   - Ajustar `public/firebase-messaging-sw.js` para usar somente a configuração passada pela query string do registro dedicado.
   - Remover o fallback para `/firebase-config.generated.js`, que hoje pode gerar o log conflitante `Missing Firebase config`.
   - Manter o FCM worker separado do PWA worker no escopo `/firebase-cloud-messaging-push-scope/`.

3. **Corrigir o fluxo de geração do token**
   - Em `src/lib/firebase.ts`, remover o reset automático antes da primeira chamada a `getToken()`.
   - Fluxo normal: carregar config runtime → registrar/reutilizar SW FCM → chamar `getToken()` uma vez → salvar token.
   - Se a primeira tentativa falhar por erro de inscrição push, executar um hard reset controlado e tentar somente mais uma vez.
   - Fazer o reset controlar ordem e espera: `deleteToken()` quando possível, `PushSubscription.unsubscribe()` como fallback, unregister apenas de workers FCM antigos/inválidos e pequeno aguardo antes do novo registro.

4. **Garantir apenas um FCM worker válido**
   - Remover registros antigos de `firebase-messaging-sw.js` com escopo `/`.
   - Remover registros FCM sem query string de configuração.
   - Não tocar no service worker principal da PWA.
   - Preservar o botão manual “Resetar registro FCM” para recuperação explícita.

5. **Melhorar diagnóstico e mensagens de erro**
   - Trocar o erro genérico “Verifique restrições da API key” por razões específicas: `push-subscribe-failed`, `vapid-invalid`, `firebase-registration-failed`, `api-key-rejected`, `service-worker-failed`, etc.
   - Melhorar `/admin/push-test` para exibir por registro: `scope`, `scriptURL`, se possui query config, estado (`installing/waiting/active`) e se existe `PushSubscription`.
   - Exibir fingerprints seguros da config pública, sem revelar secrets: `projectId`, últimos 4 dígitos do sender ID, prefixo do appId e hash curto da VAPID.

6. **Validação backend sem expor segredos**
   - Conferir o que a função `send-push-notification` já valida e, se necessário, expor no diagnóstico administrativo apenas um status sanitizado de compatibilidade entre `FIREBASE_PROJECT_ID` e o `project_id` da service account.
   - Não revelar service account, chaves privadas ou valores completos de secrets.

7. **Testes de aceite**
   - Confirmar que `firebase-public-config` responde 200.
   - Confirmar que não aparece mais `Missing Firebase config` no fluxo correto.
   - Confirmar que existe apenas um FCM worker dedicado.
   - Confirmar que a primeira ativação gera token sem reset prévio.
   - Confirmar que uma segunda ativação reutiliza/renova token sem cancelar a inscrição válida.
   - Confirmar que o token é salvo em `fcm_tokens` e que o teste em `/admin/push-test` retorna `sent: 1` quando há dispositivo elegível.

## Arquivos previstos
- `src/lib/firebase.ts`
- `public/firebase-messaging-sw.js`
- `src/hooks/usePushNotifications.ts`
- `src/pages/admin/AdminPushTest.tsx`
- `vite.config.ts`
- `package.json`
- `.env.example`
- `docs/firebase-fcm.md`
- Possivelmente `supabase/functions/firebase-public-config/index.ts` ou `send-push-notification/index.ts` apenas para diagnóstico sanitizado, se necessário.