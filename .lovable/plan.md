## Objetivo

Expor uma nova ferramenta MCP `create_demand` no servidor SoMA para que assistentes conectados (ChatGPT, Claude, Cursor, etc.) possam criar demandas em nome do usuário autenticado, respeitando as permissões (RLS) e limites do plano.

## Escopo

Uma única ferramenta nova. Sem alterações em tabelas, RLS, ou UI. Continua usando o fluxo OAuth existente do MCP.

## Nova ferramenta: `create_demand`

Arquivo: `src/lib/mcp/tools/create-demand.ts`

Entradas (Zod):
- `board_id` (uuid, obrigatório) — quadro onde a demanda será criada
- `title` (string, 1–200, obrigatório)
- `description` (string, opcional)
- `priority` (`"baixa" | "média" | "alta" | "urgente"`, opcional, default `"média"`)
- `due_date` (ISO string, opcional)
- `status_id` (uuid, opcional) — se omitido, usa o primeiro status ativo do quadro (menor `position`)
- `service_id` (uuid, opcional)
- `assignee_user_id` (uuid, opcional) — se omitido, o próprio usuário autenticado vira o responsável (`is_primary = true`)

Anotações: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`.

Fluxo do handler:
1. `ctx.isAuthenticated()` — caso contrário, erro.
2. Criar client Supabase com o `Authorization: Bearer <ctx.getToken()>` (mesma função utilitária `sb(ctx)` do padrão dos outros tools).
3. Resolver `team_id` a partir de `boards.team_id` pelo `board_id` (respeita RLS — se o usuário não vê o quadro, erro amigável).
4. Se `status_id` não vier, buscar em `board_statuses` o menor `position` com `is_active = true` para aquele `board_id`.
5. Inserir em `demands` com `created_by = ctx.getUserId()`, `team_id`, `board_id`, `status_id`, `title`, `description`, `priority`, `due_date`.
   - Triggers/policies existentes cuidam de: numeração de sequência, limites do plano/quadro, notificações, `status_changed_at`.
6. Inserir em `demand_assignees` o responsável (`is_primary = true`) com o `assignee_user_id` (ou o próprio caller).
7. Retornar `structuredContent: { demand: {...campos principais...} }` e um `content` textual com o id e título.

Tratamento de erros: qualquer erro do Postgres/RLS é retornado como `{ isError: true, content: [{ type: "text", text: error.message }] }` para o cliente MCP ver a razão exata (ex.: limite mensal, sem permissão no quadro, status inexistente).

## Registro no servidor MCP

`src/lib/mcp/index.ts`:
- Importar `createDemandTool from "./tools/create-demand"`.
- Adicionar ao array `tools`.
- Atualizar `instructions` para mencionar `create_demand` como ferramenta de escrita.

## Passos operacionais após editar

1. `app_mcp_server--extract_mcp_manifest` para regenerar `.lovable/mcp/manifest.json`.
2. `supabase--deploy_edge_functions` com `function_names: ["mcp"]` para publicar o novo tool no endpoint MCP.

## Fora de escopo

- Criação de subtarefas/dependências (o RPC `create_demand_with_subdemands` existe; podemos expor depois se você quiser).
- Anexos, comentários, aprovações.
- Ferramentas de atualização/exclusão de demanda (podem vir num próximo passo).

Se quiser, já incluo suporte a `subtasks` e múltiplos `assignees` (followers) neste mesmo tool — me avise antes de eu implementar.