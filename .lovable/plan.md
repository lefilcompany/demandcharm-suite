
# Reset total do MCP

Vou apagar tudo relacionado ao MCP do SoMA e recriar do zero um servidor mínimo, apenas com a tool `whoami`, para validar a conexão OAuth end-to-end. Depois disso, as demais 96 tools voltam de forma incremental (ou de uma vez, se você preferir) — mas isolando primeiro o problema de conexão.

## O que será removido

1. **Código do servidor MCP**
   - `src/lib/mcp/` (index.ts, _shared/, tools/*) — todo o diretório
   - `supabase/functions/mcp/index.ts` — a edge function gerada
   - `.lovable/mcp/manifest.json` — o manifest antigo

2. **Consent page e limpeza de service worker**
   - `src/pages/OAuthConsent.tsx` — apagada e reescrita do zero
   - Rota `/.lovable/oauth/consent` em `App.tsx` — reregistrada
   - Script de limpeza de SW em `index.html` — removido (não é mais necessário depois do reset)

3. **Documentação / plugin**
   - `src/pages/McpDocs.tsx` (referências ao manifest)
   - `docs/mcp/README.md`
   - Entrada `mcpPlugin()` em `vite.config.ts` — mantida (é o gerador)
   - Dependência `@lovable.dev/mcp-js` em `package.json` — mantida

4. **Backend**
   - Deletar a edge function `mcp` publicada (`supabase--delete_edge_functions`)
   - Reconfigurar o OAuth server (`supabase--configure_oauth_server`)

## O que será recriado (mínimo)

1. **`src/lib/mcp/index.ts`** — `defineMcp` com nome `soma-mcp`, versão `2.0.0`, auth OAuth apontando para `https://<project-ref>.supabase.co/auth/v1`, e apenas a tool `whoami`.

2. **`src/lib/mcp/tools/whoami.ts`** — retorna `{ user_id, email }` do token verificado. Sem query no DB, para eliminar RLS como variável no primeiro teste.

3. **`src/pages/OAuthConsent.tsx`** — versão limpa seguindo o padrão canônico da documentação (getAuthorizationDetails → approve/deny → redirect). Preserva `authorization_id` no fluxo de login.

4. **`McpDocs.tsx`** — simplificada para listar apenas a(s) tool(s) presentes no manifest regenerado.

5. **Deploy + validação**
   - `app_mcp_server--extract_mcp_manifest` para regenerar o manifest
   - `supabase--deploy_edge_functions(["mcp"])` para publicar
   - `supabase--configure_oauth_server` para reativar OAuth
   - `supabase--debug_oauth_server` para confirmar issuer, consent path e allow-list

## Depois do reset

Assim que a conexão do `whoami` funcionar num cliente MCP externo (Claude/ChatGPT/Codex), eu restauro as demais tools (teams, boards, demands, subtasks, comments, attachments, projects, requests, notifications, analytics, time, services, notes, sharing, templates) em um único commit — o código delas já existe e será recolocado, não reescrito do zero.

## Ação sua depois de eu terminar

1. No cliente MCP externo, **remover a conexão antiga** do SoMA (isso descarta o client_id/refresh_token cacheados).
2. Reconectar usando a mesma URL: `https://<project-ref>.supabase.co/functions/v1/mcp`.
3. Aprovar o consent — deve chamar `whoami` com sucesso.

Confirma que posso executar esse reset?
