
# Expansão completa do MCP do SoMA

Transformar o MCP atual (6 tools) em uma API completa que expõe todos os domínios operacionais do SoMA, respeitando estritamente RLS (o token do usuário é sempre repassado ao Supabase — nunca `service_role`). Toda ação executável pelo usuário no app poderá ser executada por um cliente MCP conectado (ChatGPT, Claude, etc.).

## Escopo por domínio

Cada tool recebe metadata explícita de permissão (`annotations.readOnlyHint`, `destructiveHint`) e descrição clara do que exige (papel de team/board) — RLS continua sendo o guardião final.

### 1. Sessão & Perfil (read)
- `whoami` (já existe) — mantém
- `get_user_profile` — perfil detalhado (bio, cargo, avatar)
- `update_my_profile` — atualizar nome, bio, job_title, avatar_url

### 2. Times (read/write)
- `list_my_teams`
- `get_team` — detalhes + plano ativo
- `list_team_members` (com cargos e roles)
- `join_team_with_code` (RPC existente)
- `list_team_positions`
- `get_plan_limits` — usa `check_plan_limit` para retornar limites vs uso

### 3. Quadros (read/write)
- `list_boards` (já existe) — enriquecer com contagens
- `get_board` — detalhes, membros, serviços, status
- `create_board` — via RPC `create_board_with_services`
- `update_board` (nome, descrição, limite mensal)
- `archive_board` / `delete_board`
- `list_board_members` / `add_board_member` / `remove_board_member` / `update_board_member_role`
- `list_board_statuses` / `create_board_status` / `update_board_status` / `reorder_board_statuses`
- `list_board_services` / `attach_service_to_board` / `detach_service_from_board`

### 4. Demandas — CRUD & operações (read/write)
- `list_demands` (filtros: board, team, status, assignee, priority, overdue, date range, service, archived, parent) — substitui parcialmente search
- `search_demands` (já existe) — mantém
- `list_my_demands` (já existe) — mantém
- `get_demand` (já existe) — enriquecer com subtasks, dependencies, assignees, attachments, time_entries, comments (últimos N)
- `create_demand` (já existe) — expandir com `assignees[]` e `follower_ids[]`
- `create_demand_with_subdemands` — via RPC existente
- `update_demand` (title, description, priority, due_date, service_id)
- `change_demand_status` — respeita `propagate_status_to_subdemands` opcional
- `archive_demand` / `restore_demand` / `delete_demand`
- `move_demand_to_board`
- `list_demand_assignees` / `add_demand_assignee` / `set_primary_assignee` / `remove_demand_assignee`
- `list_subdemands` / `reorder_subdemands` (RPC)
- `list_demand_dependencies` / `add_dependency` / `remove_dependency`

### 5. Subtarefas (checklist) (read/write)
- `list_subtasks` / `create_subtask` / `toggle_subtask` / `update_subtask` / `delete_subtask` / `reorder_subtasks`

### 6. Comentários / Chat (read/write)
- `list_demand_comments` (canal general/internal)
- `post_demand_comment` (com detecção de menções `[[uuid:name]]`)
- `delete_demand_comment`

### 7. Anexos (read; write via URL assinada)
- `list_demand_attachments` — retorna metadados + signed URL (via edge function `demand-attachment-url`)
- `register_demand_attachment` (metadata; upload real ainda via app — MCP retorna orientação de upload)
- `delete_demand_attachment`

### 8. Time tracking (read/write)
- `start_demand_timer` / `stop_demand_timer` / `get_active_timer`
- `list_demand_time_entries`
- `manual_time_entry` (start/end)
- `get_board_time_stats` / `get_user_time_stats`

### 9. Serviços (read/write)
- `list_services` / `get_service`
- `create_service` / `update_service` / `delete_service`

### 10. Notas (read/write)
- `list_notes` (filtro por tag, arquivada, pesquisa)
- `get_note` / `create_note` / `update_note` / `archive_note` / `delete_note`
- `list_note_tags` / `create_note_tag` / `attach_tag_to_note`
- `share_note_with_user` / `list_note_shares` / `revoke_note_share`

### 11. Projetos/Pastas (read/write)
- `list_projects` / `get_project` / `create_project` / `update_project` / `delete_project`
- `add_demand_to_project` / `remove_demand_from_project`
- `share_project` / `revoke_project_share`

### 12. Solicitações (demand_requests) (read/write)
- `list_demand_requests` (status: pending, approved, rejected, returned)
- `create_demand_request` / `get_demand_request`
- `approve_demand_request` / `reject_demand_request` / `return_demand_request` (com motivo)
- `list_request_comments` / `post_request_comment`

### 13. Templates (read/write)
- `list_templates` / `get_template` / `create_template` / `update_template` / `delete_template`
- `create_demand_from_template`

### 14. Recorrentes (read/write)
- `list_recurring_demands` / `get_recurring_demand`
- `create_recurring_demand` / `update_recurring_demand` / `pause_recurring_demand` / `delete_recurring_demand`

### 15. Notificações (read/write)
- `list_notifications` (unread filter)
- `mark_notification_read` / `mark_all_notifications_read`
- `get_notification_preferences` / `update_notification_preferences`

### 16. Compartilhamento (read/write)
- `create_demand_share_token` / `list_demand_share_tokens` / `revoke_demand_share_token`
- `create_board_summary_share_token` / `revoke_board_summary_share_token`

### 17. Relatórios & Analytics (read)
- `board_summary_stats` — total, entregues, atrasadas, em andamento, por status, por assignee
- `demands_by_period` — agrupamento por dia/semana/mês
- `overdue_demands` — lista de atrasadas do escopo
- `user_productivity_stats` — tempo trabalhado, entregas, por período
- `service_usage_stats` — uso por serviço vs limite mensal

## Estrutura de arquivos

```
src/lib/mcp/
├── index.ts                   # defineMcp com todas as tools registradas
├── _shared/
│   ├── supabase.ts            # helper sb(ctx) reutilizável
│   ├── errors.ts              # helpers de erro consistentes
│   └── formatters.ts          # normalização de retornos
└── tools/
    ├── session/               # whoami, profile
    ├── teams/
    ├── boards/
    ├── demands/
    ├── subtasks/
    ├── comments/
    ├── attachments/
    ├── time/
    ├── services/
    ├── notes/
    ├── projects/
    ├── requests/
    ├── templates/
    ├── recurring/
    ├── notifications/
    ├── sharing/
    └── analytics/
```

Cada tool é um arquivo isolado com `defineTool`, `inputSchema` Zod completo, `description` rica (parâmetros, permissões exigidas, retorno), `annotations` corretas.

## Documentação

**1. Documento em `docs/mcp/README.md`** — índice completo com:
- Visão geral, autenticação (OAuth via Supabase), fluxo de conexão
- Tabela de todas as tools agrupadas por domínio: nome, tipo (read/write/destructive), permissão exigida, breve descrição
- Seção por tool: parâmetros, exemplo de invocação JSON, exemplo de retorno, códigos de erro comuns
- Guia de RLS (o que cada role pode fazer)
- Guia de erros do plano (PLAN_LIMIT_*)
- Cookbook: fluxos comuns (criar demanda com subtarefas, mudar status com timer, aprovar solicitação)

**2. Página `/mcp-docs` no app** (`src/pages/McpDocs.tsx`)
- Rota pública (não exige auth) — permite compartilhar
- Sidebar com domínios, busca de tools
- Renderiza o mesmo conteúdo do README (fonte única em `src/lib/mcp/docs.ts` com metadata estruturada)
- Blocos de código copiáveis, badges de permissão coloridos (verde read, laranja write, vermelho destructive)
- Link no rodapé/menu do app

## Segurança & RLS

- Nenhum tool usa `service_role`. Sempre `createClient(SUPABASE_URL, PUBLISHABLE_KEY, { headers: { Authorization: Bearer <ctx.getToken()> } })`.
- Tools destrutivas (`delete_*`, `archive_*`, `revoke_*`) marcadas com `destructiveHint: true` → o cliente MCP mostra confirmação.
- Validação Zod estrita em toda entrada (uuids, enums, ranges).
- Erros padronizados: `{ isError: true, content: [{ type:"text", text: <mensagem clara> }] }` com prefixo `PLAN_LIMIT_`, `PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION`.
- Nunca logar ou retornar tokens.

## Passos de implementação

1. Criar helpers em `src/lib/mcp/_shared/`.
2. Reorganizar as 6 tools existentes nos novos subdiretórios (mantém compatibilidade — mesmos nomes).
3. Implementar as tools novas em batches por domínio (teams → boards → demands core → subtasks/comments → time → services/notes/projects → requests/templates/recurring → notifications/sharing → analytics).
4. Atualizar `src/lib/mcp/index.ts` importando e registrando todas.
5. Rodar `app_mcp_server--extract_mcp_manifest` para validar.
6. Deploy da edge function `mcp` via `supabase--deploy_edge_functions`.
7. Criar `src/lib/mcp/docs.ts` com metadata estruturada.
8. Escrever `docs/mcp/README.md`.
9. Criar página `src/pages/McpDocs.tsx` + rota em `src/App.tsx`.
10. Adicionar link discreto para `/mcp-docs` (rodapé ou Settings → Integrações).

## Fora do escopo

- Ferramentas administrativas globais (admin_*) — usuário optou por não incluir.
- Upload direto de arquivos binários via MCP (tools aceitam URLs/metadados; upload real segue no app por questões de tamanho/timeout — documentado).
- WhatsApp inbound, webhooks públicos, API keys — infra separada, não faz parte do MCP OAuth.

## Detalhes técnicos

- Idioma: descrições das tools em inglês (padrão MCP para melhor matching por LLMs), retornos e mensagens de erro em português (consistente com o app).
- `stopWhen` não se aplica (tools são sync, um-tiro).
- Nenhuma migration SQL necessária — todas as tools usam schema e RPCs já existentes.
- Compatibilidade: nomes das 6 tools atuais mantidos → integrações existentes seguem funcionando.

Após sua aprovação, entro em build mode e implemento em ordem, começando pelos helpers e core (demandas/boards) e evoluindo por domínio.
