## Problema

Ao tentar conectar o MCP do SoMA em outra plataforma (ChatGPT/Claude/etc.), o usuário é redirecionado para `/.lovable/oauth/consent?authorization_id=...` e vê:

> Cannot read properties of undefined (reading 'getAuthorizationDetails')

Causa: `src/pages/OAuthConsent.tsx` chama `supabase.auth.oauth.getAuthorizationDetails(...)`, mas o projeto está travado em `@supabase/supabase-js` **2.49.8**, versão que **não** expõe o namespace beta `auth.oauth`. Em runtime, `supabase.auth.oauth` é `undefined`. O cast TypeScript no arquivo mascara isso em build-time mas não cria o método. A versão atual do pacote é `2.110.7`, que já inclui o namespace `auth.oauth`.

## Correção

Atualizar `@supabase/supabase-js` para `^2.110.7` (menor major, sem breaking changes previstos para o cliente já em uso). Isso ativa `supabase.auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization` em runtime e a tela de consent passa a carregar os detalhes do cliente OAuth e a renderizar Autorizar/Cancelar corretamente.

Nenhuma outra mudança de código é necessária — o `OAuthConsent.tsx` já implementa o fluxo correto (session check → `getAuthorizationDetails` → approve/deny → redirect). O wrapper tipado local (`SupabaseOAuth`) continua válido.

## Passos

1. `package.json`: bump `@supabase/supabase-js` de `2.49.8` para `^2.110.7`.
2. Reinstalar dependências (auto).
3. Validar em runtime abrindo `/.lovable/oauth/consent?authorization_id=<id>` com um authorization_id real, ou refazendo a conexão do MCP a partir da plataforma externa.

## Detalhes técnicos

- O arquivo auto-gerado `src/integrations/supabase/client.ts` não muda — apenas a versão do pacote.
- `src/integrations/lovable/index.ts` usa `supabase.auth.setSession` (API estável), sem impacto.
- Os tipos gerados em `src/integrations/supabase/types.ts` são compatíveis entre `2.49` e `2.110`.
- Alternativa descartada: chamar direto `/auth/v1/oauth/authorizations/:id` via fetch — mais frágil e contraria a orientação da knowledge (`cloud-auth-oauth-server`), que exige uso dos helpers `supabase.auth.oauth`.

## Fora de escopo

- Nenhuma mudança no MCP server, tools, ou edge function `mcp`.
- Nenhuma alteração de RLS, migrations ou auth config.