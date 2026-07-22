## Plano para corrigir “Notificações push indisponíveis no momento”

### Diagnóstico confirmado
- A mensagem vem do caminho `missing-config` em `src/lib/firebase.ts`: o frontend não está recebendo todos os valores `VITE_FIREBASE_*`, especialmente a chave VAPID.
- Os secrets de Firebase existem no backend, mas o arquivo público gerado `public/firebase-config.generated.js` ainda está com `self.__FIREBASE_CONFIG__ = null`, então o service worker também está sem configuração.
- O script gerador lê `VITE_FIREBASE_*`, mas a promoção de `FIREBASE_*` para `VITE_FIREBASE_*` está só no `vite.config.ts`; isso não ajuda o script quando ele roda antes do Vite.

### Correção proposta
1. **Centralizar a leitura da configuração Firebase no script gerador**
   - Atualizar `scripts/generate-firebase-config.mjs` para também aceitar os secrets sem prefixo (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, etc.) e convertê-los internamente para os campos públicos esperados.
   - Manter `VITE_*` como prioridade quando existir.

2. **Gerar um arquivo público válido para o service worker**
   - Fazer o generator escrever `public/firebase-config.generated.js` com os 6 campos públicos do Firebase quando os secrets existirem.
   - Continuar sem incluir `FIREBASE_VAPID_KEY` nesse arquivo, porque ela só precisa ficar no bundle do frontend.

3. **Garantir que o frontend enxergue a VAPID key**
   - Manter/ajustar a promoção no `vite.config.ts` para que `FIREBASE_VAPID_KEY` seja exposto como `VITE_FIREBASE_VAPID_KEY` durante o build/dev.
   - Corrigir qualquer lacuna para que `requestNotificationPermission()` deixe de cair em `missing-config`.

4. **Melhorar a mensagem de erro no card/admin**
   - Trocar o toast genérico por uma mensagem mais clara quando faltar configuração, indicando que o push ainda não está configurado no ambiente atual.
   - Se possível, exibir no card um status separado para “configuração Firebase carregada” e “permissão do navegador”.

5. **Validar sem disparar notificações reais desnecessárias**
   - Conferir que `/firebase-config.generated.js` não está mais `null`.
   - Abrir `/admin/profile` e verificar que o botão de ativação não retorna mais “indisponível no momento”.
   - Confirmar que, após permissão do navegador, o fluxo tenta registrar token FCM e salva via `register_fcm_token`.