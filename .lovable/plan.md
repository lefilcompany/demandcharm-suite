
# Apagar 100% do MCP

Desinstalar completamente o servidor MCP e todos os vestígios — como se o projeto nunca tivesse tido MCP. A tela "Agent integrations" mostra o servidor porque o manifest ainda existe e o `mcpPlugin()` continua no Vite. Preciso remover tudo.

## Arquivos que vão ser apagados

**Código do servidor:**
- `src/lib/mcp/` (index.ts + tools/whoami.ts) — diretório inteiro
- `supabase/functions/mcp/` — diretório inteiro (gerado)
- `.lovable/mcp/manifest.json` — manifest que alimenta a UI de Agent Integrations

**Páginas e rotas:**
- `src/pages/OAuthConsent.tsx`
- `src/pages/McpDocs.tsx`
- Rotas `/.lovable/oauth/consent` e `/mcp-docs` em `src/App.tsx` (imports lazy + `<Route>`)

**Vite plugin e dependência:**
- Remover `import { mcpPlugin }` e a chamada `mcpPlugin()` de `vite.config.ts`
- Remover `@lovable.dev/mcp-js` de `package.json`

**Backend:**
- `supabase--delete_edge_functions(["mcp"])` para apagar a função publicada

## Consequências

- A UI "Agent integrations" (More → Agent integrations) ficará vazia, mostrando o estado "sem MCP configurado".
- O endpoint `https://<ref>.supabase.co/functions/v1/mcp` deixará de responder.
- O consent page `/.lovable/oauth/consent` some — o OAuth server no backend continua ativado, mas sem consumidores. Se quiser, posso também rodar um "reset" removendo a configuração; me diga se quer isso também.

## Depois

Se um dia você quiser reativar o MCP, é do zero: reinstalar o pacote, adicionar o plugin, criar as tools novamente. Todo o código atual das 97 tools originais está no histórico do projeto (pode ser restaurado via Revert), mas depois desse comando ele desaparece do working tree.

Confirma que posso executar o apagamento total?
