# SoMA MCP API — Documentação completa

**Versão:** 1.0.0 · **Ferramentas:** 97 · **Transporte:** MCP Streamable HTTP · **Auth:** OAuth 2.1 (Supabase)

Servidor MCP que expõe a plataforma SoMA como API para assistentes de IA (Claude, ChatGPT, Cursor, Codex, etc.). Toda ferramenta opera como o usuário conectado — nenhuma chamada usa credenciais privilegiadas do servidor. Row-Level Security (RLS) do banco é o guardião final.

## Endpoint

```
https://<seu-projeto>.supabase.co/functions/v1/mcp
```

A URL exata da instância aparece na página `/mcp-docs` do app publicado.

## Como conectar

1. No cliente MCP, adicione um servidor HTTP com a URL acima.
2. Ao invocar qualquer ferramenta pela primeira vez, o cliente abre o fluxo OAuth 2.1 do SoMA (via Supabase Auth) para aprovar o acesso.
3. Após aprovado, todas as ferramentas ficam disponíveis. O token é renovado automaticamente.

Dynamic Client Registration (DCR) e Client ID Metadata Document (CIMD) são suportados — nenhuma configuração manual de client_id é necessária.

## Modelo de permissões

Todas as ferramentas respeitam:

- **Team role** (`admin` / `moderator` / `member` / `requester`) — determina o que o usuário pode fazer no time.
- **Board role** (`admin` / `moderator` / `executor` / `requester`) — refina permissões por quadro.
- **RLS** — cada tabela tem políticas que filtram/autorizam operações.
- **Limites de plano** — inserts que ultrapassam limite retornam `PLAN_LIMIT_*`.

Cada ferramenta declara em `annotations`:

| Marca              | Significado                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `readOnlyHint`     | Não modifica dados. Seguro para chamar livremente.                 |
| `destructiveHint`  | Modificação irreversível (delete, revoke, archive definitivo).     |
| `idempotentHint`   | Chamadas repetidas produzem o mesmo resultado.                     |

Clientes MCP normalmente pedem confirmação humana em ferramentas destrutivas.

## Convenções

- Todos os UUIDs são validados via Zod (`z.string().uuid()`).
- Datas são ISO-8601 com timezone (`2026-07-10T14:00:00-03:00`).
- Retornos: `content` com JSON texto + `structuredContent` com o objeto principal.
- Erros: `isError: true` e mensagem no formato `CODIGO: descrição`.

### Códigos de erro

| Código               | Significado                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `PERMISSION_DENIED`  | RLS ou verificação de role recusou a operação.                     |
| `NOT_FOUND`          | Recurso inexistente ou fora do escopo do usuário.                  |
| `VALIDATION`         | Entrada inválida (falta parâmetro, valor fora de faixa).           |
| `PLAN_LIMIT_*`       | Limite do plano do time atingido (boards, members, demands, …).    |
| `DB_ERROR`           | Erro genérico do banco.                                            |

## Domínios & ferramentas

Lista completa navegável em `/mcp-docs`. Grupos:

### Sessão & Perfil
`whoami`, `get_user_profile`, `update_my_profile`

### Times
`list_my_teams`, `get_team`, `list_team_members`, `list_team_positions`, `join_team_with_code`, `get_plan_limits`

### Quadros
`list_boards`, `get_board`, `create_board`, `update_board`, `archive_board`, `delete_board`,
`list_board_members`, `add_board_member`, `update_board_member_role`, `remove_board_member`,
`list_board_statuses`, `list_board_services`, `attach_service_to_board`, `detach_service_from_board`

### Demandas
`list_demands`, `search_demands`, `list_my_demands`, `get_demand`, `create_demand`,
`create_demand_with_subdemands`, `update_demand`, `change_demand_status`, `archive_demand`,
`delete_demand`, `move_demand_to_board`, `list_demand_assignees`, `add_demand_assignee`,
`set_primary_assignee`, `remove_demand_assignee`, `list_demand_dependencies`, `add_dependency`,
`remove_dependency`, `reorder_subdemands`

### Subtarefas (checklist)
`list_subtasks`, `create_subtask`, `toggle_subtask`, `update_subtask`, `delete_subtask`

### Comentários / Chat
`list_demand_comments`, `post_demand_comment`, `delete_demand_comment`

### Anexos
`list_demand_attachments`, `get_attachment_url`, `delete_demand_attachment`

### Time tracking
`start_demand_timer`, `stop_demand_timer`, `get_active_timer`,
`list_demand_time_entries`, `manual_time_entry`

### Serviços
`list_services`, `get_service`, `create_service`, `update_service`, `delete_service`

### Notas
`list_notes`, `get_note`, `create_note`, `update_note`, `archive_note`, `delete_note`,
`share_note_with_user`, `revoke_note_share`

### Projetos / Pastas
`list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`,
`add_demand_to_project`, `remove_demand_from_project`

### Solicitações
`list_demand_requests`, `get_demand_request`, `create_demand_request`,
`respond_demand_request`, `post_request_comment`

### Templates & Recorrentes
`list_templates`, `get_template`, `list_recurring_demands`, `pause_recurring_demand`

### Notificações
`list_notifications`, `mark_notification_read`, `mark_all_notifications_read`

### Compartilhamento
`create_demand_share_token`, `list_demand_share_tokens`, `revoke_demand_share_token`

### Analytics
`board_summary_stats`, `demands_by_period`, `overdue_demands`, `user_productivity_stats`

## Cookbook

### Criar demanda com subdemandas em cadeia

```json
{
  "tool": "create_demand_with_subdemands",
  "input": {
    "parent": {
      "board_id": "…", "team_id": "…", "status_id": "…",
      "title": "Landing do lançamento", "priority": "alta"
    },
    "subdemands": [
      { "title": "Copy", "status_id": "…" },
      { "title": "Design", "status_id": "…" },
      { "title": "Publicação", "status_id": "…" }
    ],
    "dependencies": [
      { "demand_index": 2, "depends_on_index": 1 },
      { "demand_index": 3, "depends_on_index": 2 }
    ]
  }
}
```

### Fluxo "trabalhar em uma demanda"

1. `list_my_demands` → escolher.
2. `start_demand_timer { demand_id }`.
3. `change_demand_status { demand_id, status_id: <Fazendo> }`.
4. Ao terminar: `stop_demand_timer` + `change_demand_status { status_id: <Entregue>, propagate_to_subdemands: true }`.

### Aprovar solicitação

```
respond_demand_request { request_id, action: "approved" }
```

### Gerar link público

```
create_demand_share_token { demand_id, expires_at: "2026-08-01T00:00:00Z" }
```
O retorno inclui `token`. URL final: `https://<app>/shared/<token>`.

## Anexos

Upload de arquivos binários não é feito via MCP (tamanho/latência inviabilizam sync). Fluxo:

1. Upload real no app SoMA (drag-drop) ou via storage direto do Supabase.
2. Ferramentas MCP leem metadados (`list_demand_attachments`), obtêm URL de download assinada (`get_attachment_url`) ou removem (`delete_demand_attachment`).

## Notas finais

- Endpoint OAuth issuer: `https://<projeto>.supabase.co/auth/v1` (obrigatório — host direto, não proxy).
- Todas as ferramentas escritas em TypeScript, bundled para Deno em `supabase/functions/mcp/index.ts` (auto-gerado — **não edite à mão**).
- Adicionar/editar ferramentas: `src/lib/mcp/tools/*.ts` → regenerar manifest via CI → deploy `mcp`.
