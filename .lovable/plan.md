## Plano para corrigir o push FCM

1. **Separar corretamente a config do Firebase no service worker**
   - Ajustar o worker para aceitar `vapidKey` sem exigir esse campo dentro da config usada para `firebase.initializeApp()`.
   - Evitar que o worker mostre “Missing Firebase config” quando a config chega por URL ou pelo arquivo gerado.

2. **Corrigir o fluxo de emissão do token**
   - Não reutilizar uma instância antiga do Firebase Messaging depois de limpar token/PushSubscription.
   - Após resetar o registro, recriar o worker/messaging em uma ordem segura antes de chamar `getToken()` novamente.
   - Melhorar a validação do service worker para considerar o script base `/firebase-messaging-sw.js` mesmo quando há query params com config.

3. **Fortalecer fallback de configuração**
   - Manter a ordem: variáveis inline/geradas → `/firebase-config.generated.js` → função `firebase-public-config`.
   - Remover inconsistências de nomenclatura interna: o fallback ainda está chamado de “supabase” no código; vou trocar para um nome neutro de backend/runtime.

4. **Melhorar diagnóstico em `/admin/push-test`**
   - Mostrar qual origem de config está sendo usada e se o worker ativo recebeu a config esperada.
   - Fazer o botão de reset limpar também o estado interno do Firebase no frontend antes de tentar novamente.

5. **Validar sem mexer em secrets**
   - Verificar que `/firebase-config.generated.js` está respondendo com config completa.
   - Testar o fluxo no preview com Playwright até o ponto possível sem aceitar permissões reais do navegador, e confirmar que não há erro de config ausente no worker.

**Observação:** pelos sinais já lidos, `/firebase-config.generated.js` está retornando a config completa, então a correção será focada no fluxo de inicialização/registro do worker e na limpeza/recriação do Messaging, não em pedir novas chaves.