## Objetivo

Adicionar um painel de login (email + senha) na página pública `/mcp-docs` que autentica um **usuário real** e devolve um `access_token` JWT já preenchido no Try-It, permitindo executar todas as tools MCP (exceto as que consomem crédito de LLM/imagem).

## Como vai funcionar

```text
[/mcp-docs] ── email + senha ──► [edge function: mcp-test-login]
                                        │
                                        ├─ signInWithPassword (Supabase)
                                        │
                                        ◄── { access_token, expires_at, user }
[TryItPanel] preenche o campo Access Token automaticamente
             ► chama tools normalmente no endpoint /functions/v1/mcp
```

## Mudanças

### 1. Edge function nova `supabase/functions/mcp-test-login/index.ts`
- Aceita `POST { email, password }` com CORS liberado.
- Valida entrada com Zod (email válido, senha mínima).
- Cria client Supabase com anon key e chama `auth.signInWithPassword`.
- Retorna `{ access_token, refresh_token, expires_at, user: { id, email } }` em caso de sucesso, ou erro amigável (credenciais inválidas, email não confirmado etc.).
- Sem rate limiting sofisticado — é o mesmo endpoint público que o app já expõe via `/auth/v1/token`, então não abre nova superfície de ataque; adiciono só um `retry-after` básico se `signInWithPassword` devolver 429.
- Nunca loga senha nem token.

### 2. Ajuste no MCP para aceitar tokens de sessão do app
Em `src/lib/mcp/index.ts`, no `auth.oauth.issuer(...)`, adicionar `requireOAuthClientClaim: false`.

Por quê: tokens de `signInWithPassword` não carregam `client_id` e seriam rejeitados. Como o issuer/JWKS/audience continuam sendo validados pelo Supabase, o token continua sendo **um JWT real do usuário** — a única diferença é aceitar tanto tokens OAuth (de clientes externos como ChatGPT/Claude) quanto tokens de sessão do próprio app. Documentar isso claramente no README do MCP.

### 3. Painel de login no `src/pages/McpDocs.tsx`
Novo componente `TryItLoginPanel` no topo da coluna direita (ou dentro do `TryItPanel`):
- Campos: email, senha, botão "Gerar token de teste".
- Mostra: usuário logado, expiração do token, botão "Sair" que limpa.
- Armazena o token só em memória (React state) + `sessionStorage` (não `localStorage`), com aviso.
- Preenche automaticamente o campo `Access Token` já existente no `TryItPanel`.
- Aviso visível: "Login usa suas credenciais reais do SoMA+. Não use em contas administrativas."

### 4. Filtro de tools "que gastam crédito"
No `TryItPanel`, desabilitar o botão Executar para tools cujo nome bate com uma allowlist de exclusão (ex.: qualquer nome contendo `image`, `generate`, `ai_`, `llm`). Como o MCP atual não expõe geração de imagem/LLM, o filtro fica preparado mas hoje não bloqueia nada — só um `MEMO` no código pra quando forem adicionadas.

### 5. Documentação
Adicionar seção "Autenticação de teste" na doc explicando:
- Como obter o token (formulário na própria página).
- Diferença entre token de sessão (este) e token OAuth (produção, via `supabase.auth.oauth`).
- Que RLS aplica normalmente — o usuário só vê o que enxerga no app.

## Fora do escopo
- Não mexe no fluxo OAuth real (`/.lovable/oauth/consent`) usado por Claude/ChatGPT.
- Não adiciona refresh automático do token — se expirar, o usuário loga de novo.
- Não altera nenhuma tool existente.

## Riscos
- `requireOAuthClientClaim: false` afrouxa um pouco a política: qualquer sessão válida do app pode chamar o MCP. Isso é aceitável porque o SoMA+ já é o mesmo domínio de confiança, e RLS continua sendo a barreira real.
