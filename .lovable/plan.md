## Diagnóstico

O bundle publicado em `pla.soma.lefil.com.br` (`assets/index-gl4rGBKu.js`) **já contém** `@supabase/supabase-js@2.110.7` com o namespace `auth.oauth` inicializado (`getAuthorizationDetails`, `approveAuthorization`, `denyAuthorization` presentes). Verifiquei baixando o JS servido pelo domínio.

Ou seja, o código em produção está correto. O erro `Cannot read properties of undefined (reading 'getAuthorizationDetails')` da nova tentativa vem do **navegador servindo um bundle antigo em cache** (JS/Service Worker) — a URL do bundle anterior à correção ficou memorizada e o `supabase.auth.oauth` ainda é `undefined` naquele arquivo cacheado. Reforça isso o erro no console: `Failed to update a ServiceWorker ... /sw.js 404`, indicando SW registrado antes que hoje aponta para script inexistente e pode estar servindo assets antigos.

## Correção

Duas mudanças pequenas e complementares:

### 1. Invalidar Service Worker antigo em `index.html`

Adicionar um pequeno script inline que desregistra qualquer `ServiceWorker` previamente instalado e limpa `caches` na primeira carga. Isso libera navegadores presos ao bundle antigo em uma única visita. O snippet é idempotente (após limpar, não faz nada nas próximas cargas).

### 2. Fallback defensivo em `src/pages/OAuthConsent.tsx`

Se `supabase.auth.oauth` for `undefined` em runtime, em vez do `TypeError` cru, mostrar mensagem clara pedindo recarregar (Ctrl+Shift+R). Isso protege usuários que ainda estejam com bundle antigo antes do SW desregistrar.

```ts
const oauth = (supabase.auth as any).oauth;
if (!oauth) {
  setError("Sessão do navegador desatualizada. Recarregue a página com Ctrl+Shift+R (ou Cmd+Shift+R no Mac) e tente novamente.");
  return;
}
```

### 3. Republicar

Após as duas mudanças, republicar o app para gerar um novo hash de bundle (`index-<novoHash>.js`), forçando todos os navegadores a baixar o JS novo — o que já resolve por si só na maioria dos casos.

## Fora de escopo

- Nenhuma mudança no MCP server, tools, RLS, migrations, edge function `mcp`, ou config OAuth Supabase — o servidor de autorização e o resource server estão corretos; o problema é 100% cache de bundle no cliente.
- Nenhuma alteração no fluxo de consent em si (o código já está correto).
