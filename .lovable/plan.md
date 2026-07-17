
# Documentação MCP SoMA+ estilo Swagger

Vou construir uma nova página pública `/mcp-docs` (substituindo a atual) no estilo Swagger/Redoc: navegação por domínio, cartão de endpoint expansível com descrição, schema de entrada, exemplo pronto ("Try it") e execução real contra o servidor MCP. A string de conexão do endpoint fica oculta por padrão, controlada por uma flag (`showEndpoint`) para você habilitar depois sem refatorar.

## Rota e acesso

- Rota pública `/mcp-docs` registrada fora do `RequireAuth` no `src/App.tsx` (já existe — será reaproveitada).
- Fonte de verdade: `/.lovable/mcp/manifest.json` (99 tools, já gerado).
- SEO: `<title>` + meta description + H1 único ("MCP SoMA+ — API de Operações Marketing OS").

## Layout (3 colunas, estilo Swagger UI)

```text
+---------------------------------------------------------------+
| Header: Nome, versão, badges (OAuth 2.1, MCP 2025-06-18)      |
|         [Ocultar endpoint | Copiar cURL de exemplo]           |
+----------+----------------------------------+-----------------+
| Sidebar  | Endpoint aberto (accordion)      | Try it (painel) |
| domínios | - Descrição                      | - Inputs zod    |
| busca    | - Anotações (read-only, etc.)    | - Auth token    |
|          | - Schema JSON (colapsável)       | - Botão Executar|
|          | - Exemplo de request/response    | - Response viewer|
+----------+----------------------------------+-----------------+
```

## Comportamento "Try it"

1. Cada tool renderiza um mini-form gerado a partir do `inputSchema` (JSON Schema do manifest): campos string/uuid/enum/number/boolean/optional detectados automaticamente.
2. Campo "Access token (OAuth)" opcional no topo do painel — colado pelo usuário.
3. Botão **Executar** chama `POST {endpoint}/.mcp/invoke-tool/{name}` com:
   - `Authorization: Bearer <token colado>` quando presente
   - `Content-Type: application/json`, `Accept: application/json, text/event-stream`
   - Body = valores digitados
4. Response mostra status, latência, corpo formatado + botão "Copiar cURL".
5. Sem token, o painel mostra aviso amigável explicando que endpoints exigem OAuth e link para "Como conectar via Orchestrator".

## Ocultação da string de conexão

- Constante `SHOW_ENDPOINT = false` no topo do arquivo.
- Quando `false`: exibe placeholder `https://•••••••••••.supabase.co/functions/v1/mcp` e os exemplos cURL usam `{MCP_ENDPOINT}` como variável.
- Quando `true` (flip futuro de uma linha): mostra a URL real e injeta nos exemplos.
- O fetch do "Try it" ainda usa a URL real internamente (via `import.meta.env.VITE_SUPABASE_PROJECT_ID`) — ela nunca aparece renderizada quando a flag é `false`.

## Seções globais (topo, antes dos endpoints)

- **Visão geral**: o que é o MCP SoMA+, fluxo AEIOU, ligação com Marketing OS Orchestrator.
- **Autenticação**: OAuth 2.1 + PKCE + DCR, issuer `https://<ref>.supabase.co/auth/v1`, escopo padrão `openid email profile`. Sem chave estática.
- **Envelope de resposta**: `source`, `generated_at`, `open_url`, `warnings`, `error_code`, `recovery_options`.
- **Códigos de erro**: tabela (`PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION`, `PLAN_LIMIT`, `DB_ERROR`, `AUTH_EXPIRED`, `TIMEOUT`, `PARTIAL_RESULT`, `UNSUPPORTED`).
- **Fluxo recomendado**: whoami → list_my_teams → list_boards → operar.

## Geração de exemplos

- Para cada tool, gerar exemplo de payload a partir do `inputSchema.properties`:
  - `uuid` → `"00000000-0000-0000-0000-000000000000"`
  - `enum` → primeiro valor
  - `string` → placeholder descritivo
  - `integer` → valor mínimo ou `10`
- Exemplo de response = envelope padrão com campo do domínio (mock estático).
- cURL gerado dinamicamente com `{MCP_ENDPOINT}` ou URL real conforme flag.

## Arquivos

- **Novo:** `src/pages/McpDocs.tsx` (substitui a versão atual, mais rica).
- **Novo:** `src/lib/mcp-docs/exampleFromSchema.ts` — gera payload de exemplo a partir do JSON Schema.
- **Novo:** `src/lib/mcp-docs/curlBuilder.ts` — monta comando cURL a partir de tool + valores.
- **Novo:** `src/components/mcp-docs/EndpointCard.tsx` — accordion + Try it.
- **Novo:** `src/components/mcp-docs/TryItPanel.tsx` — form dinâmico + execução + response viewer.
- **Novo:** `src/components/mcp-docs/SchemaField.tsx` — input adaptado ao tipo.
- **Sem alteração** em `src/App.tsx` (a rota `/mcp-docs` já existe e é pública).
- **Sem alteração** no MCP server (`src/lib/mcp/**`) — a doc só lê o manifest.

## Design (segue memória do projeto)

- Cores: Primary `#F28705`, Secondary `#1D1D1D`, fundo branco/`bg-background`.
- Layout `100dvh`, painéis `rounded-xl` `shadow-sm`, scroll com `scrollTop` (nunca `scrollIntoView`).
- Badges: read-only (cinza), destructive (vermelho `bg-destructive`), idempotent (outline), auth-required (laranja).
- Tipografia consistente com o resto do app (shadcn `Card`, `Badge`, `Input`, `ScrollArea`, `Tabs`).

## Segurança

- Página pública, sem PII — só lê o manifest público.
- Try it só executa se o usuário colar o próprio token. Nenhum token é armazenado (apenas `useState` da sessão; opcional: `sessionStorage` com aviso).
- Nenhum log/telemetria envia o token para lugar nenhum.
- CORS: chamada é browser→edge function `mcp`, que já responde com headers apropriados no handler oficial.

## Aceitação

- [ ] `/mcp-docs` acessível deslogado.
- [ ] Sidebar mostra 18 domínios com contagens corretas (99 tools).
- [ ] Cada tool tem descrição, badges, schema colapsável, exemplo request + response e botão "Executar".
- [ ] Com `SHOW_ENDPOINT = false`, a URL real do MCP não aparece em lugar nenhum da UI nem nos exemplos cURL renderizados.
- [ ] Try it dispara request real quando token OAuth é colado; sem token, mostra aviso.
- [ ] Response mostra status, latência (ms) e corpo formatado com syntax highlight simples.
- [ ] Botão "Copiar cURL" copia comando com `{MCP_ENDPOINT}` placeholder.
- [ ] Passa typecheck.
