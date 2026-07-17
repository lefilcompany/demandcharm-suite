
# MCP SoMA+ v2 — Servidor completo alinhado ao Marketing OS (AEIOU)

Objetivo: transformar o MCP atual (9 tools genéricas) num **servidor MCP de operações** completo, coerente com o `CONTEXT.md` do Marketing OS Orchestrator, com os descritivos AEIOU / Marketing OS / SoMA+, e com contratos de resposta, códigos de erro e documentação por endpoint bem definidos — pronto para o Orchestrator consumir sem tratativas ad-hoc.

Nada será feito antes da sua aprovação.

---

## 1. Fundações compartilhadas (envelope + shared helpers)

Reescreve `src/lib/mcp/_shared/` para padronizar TODAS as respostas, conforme SoMA+ §20 e §24:

- `envelope.ts` — helpers `ok`, `okList`, `okCreated`, `okUpdated`, `err`, e formatação `structuredContent` sempre com:
  - `source: "soma"`
  - `generated_at` (ISO-8601 com fuso)
  - `open_url` quando o recurso tem tela no SoMA+ (`/boards/:id`, `/demands/:id`, `/requests/:id`, etc.)
  - `warnings: []` array para avisos não-fatais (limites próximos, deprecações)
- `errors.ts` — códigos normalizados: `PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION`, `PLAN_LIMIT_*`, `DB_ERROR`, `AUTH_EXPIRED`, `TIMEOUT`, `PARTIAL_RESULT`, cada um com `user_message` e `recovery_options[]` conforme §24.
- `supabase.ts` — mantém `sb(ctx)` bindado ao JWT do caller (RLS respeitada), adiciona `sbAdmin` **proibido** (guard que joga erro se algum tool tentar importar).
- `urls.ts` — builder centralizado de `open_url` a partir do `PUBLIC_APP_URL` (env), evita rotas por suposição (§25.10).
- `zod-common.ts` — schemas reutilizáveis (uuid, iso-date, priority enum, board-role enum, team-role enum).

---

## 2. Catálogo de tools por domínio (estrutura de arquivos)

Reorganiza `src/lib/mcp/tools/` em pastas por domínio (SoMA+ §21). Cada arquivo exporta várias `defineTool` do mesmo domínio; o `index.ts` importa por domínio e faz o spread:

```
src/lib/mcp/tools/
  session/          whoami, get_profile, update_profile
  teams/            list_my_teams, get_team, list_team_members, list_team_positions, join_team_with_code, get_plan_limits
  boards/           list_boards, get_board, create_board, update_board, archive_board, list_board_members, add_board_member, update_board_member_role, remove_board_member, list_board_statuses, create_board_status, update_board_status, reorder_board_statuses, list_board_services, attach_service_to_board
  demands/          list_demands, search_demands, get_demand, create_demand, create_demand_with_subdemands, update_demand, move_demand, assign_demand, add_follower, remove_follower, add_dependency, remove_dependency, archive_demand, delete_demand
  subtasks/         list_subtasks, create_subtask, toggle_subtask, update_subtask, delete_subtask
  comments/         list_comments, post_comment, delete_comment
  attachments/      list_attachments, get_attachment_url, delete_attachment, request_attachment_upload  (§25.5 lacuna)
  time/             start_demand_timer, stop_demand_timer, get_active_timer, list_time_entries, log_time_entry, user_time_summary
  services/         list_services, get_service, create_service, update_service, delete_service
  notes/            list_notes, get_note, create_note, update_note, archive_note, share_note
  projects/         list_projects, get_project, create_project, update_project, link_demand_to_project
  requests/         list_demand_requests, get_demand_request, create_demand_request, respond_to_request (approve|reject|return), list_request_comments, post_request_comment
  templates/        list_templates, get_template, create_template, update_template, delete_template (§25.6)
  recurring/        list_recurring_demands, get_recurring_demand, create_recurring_demand, update_recurring_demand, pause_recurring, resume_recurring, delete_recurring (§25.6)
  notifications/    list_notifications, mark_notification_read, mark_all_read, get_notification_preferences, update_notification_preferences (§25.7)
  sharing/          create_demand_share_token, list_demand_share_tokens, revoke_demand_share_token, create_board_summary_share, create_note_share_token
  analytics/        board_summary_stats, board_summary_history, overdue_demands, due_soon_demands, get_operational_snapshot (§25.1), risk_of_delay (§25.2), time_per_stage (§25.3), user_productivity_stats, capacity_by_user (§25.4)
  meta/             list_capabilities, get_server_version, ping
```

Total-alvo: **~110 tools** (cobre o catálogo atual + preenche as lacunas de §25 do descritivo SoMA+). Cada tool traz:

- `name`, `title`, `description` (frase única, verbo forte)
- `inputSchema` Zod completo (nunca aceitar `user_id` no input — vem do `ctx`)
- `annotations` corretas (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- Handler retornando envelope padronizado com `open_url`

---

## 3. Tools novas (fechando lacunas do §25)

Implementações que **não existem** hoje e são explicitamente pedidas pelo descritivo:

| Tool | Retorno | Uso pelo Orchestrator |
|---|---|---|
| `get_operational_snapshot({ board_id?, team_id? })` | contagens por etapa, atrasadas, due_soon, gargalos, aprovações pendentes, capacidade por responsável, alertas | responde "Como está a operação?" em 1 chamada |
| `risk_of_delay({ board_id, window_days })` | demandas com prazo próximo, sem atividade, com dependência bloqueadora | responde "O que está em risco?" |
| `time_per_stage({ board_id, period })` | tempo médio de permanência por etapa (via `demand_interactions`) | diagnóstico de gargalo |
| `capacity_by_user({ team_id })` | demandas ativas ponderadas por prioridade/prazo/esforço | "Quem está sobrecarregado?" |
| `create_recurring_demand`, `update_recurring_demand`, `delete_recurring_demand` | CRUD completo (hoje só existe pause/resume) | "Faça isso toda segunda" |
| `create_template`, `update_template`, `delete_template` | CRUD de templates | reutilização de estrutura |
| `get_notification_preferences`, `update_notification_preferences` | preferências por canal (in-app, email, push) | agente ajusta pelo chat |
| `request_attachment_upload({ demand_id, filename, content_type, size })` | retorna `signed_upload_url` + `attachment_id` reservado; um segundo call `confirm_attachment_upload` fixa o vínculo | fluxo assíncrono de anexos (§25.5) |
| `list_capabilities()` | versão, tools disponíveis, feature flags | descoberta pelo Orchestrator |

Cada nova tool inclui **migração SQL** apenas quando necessário (ex.: `notification_preferences` já existe em `user_preferences`; anexos precisam de coluna `upload_status`).

---

## 4. Metadados de origem AEIOU (§25.9)

Adiciona coluna opcional em `demands`:

```sql
ALTER TABLE demands ADD COLUMN aeiou_origin jsonb;
-- Formato: { pillar: 'A'|'E'|'I'|'O'|'U', source_tool: string, source_ref: string, recommendation_id: string, marketing_os_project_id: uuid }
```

`create_demand` e `create_demand_with_subdemands` aceitam `aeiou_origin` opcional. `get_demand` devolve o campo. Permite ao Orchestrator rastrear "essa demanda nasceu da recomendação X do LeKPIs".

Grants + RLS mantidos (usa política existente de `demands`).

---

## 5. Instruções do servidor (aeiou_hints)

Reescreve o `instructions` do `defineMcp` para orientar o Orchestrator:

- Fluxo canônico: `whoami` → `list_my_teams` → `list_boards` → `list_board_statuses` → operar
- Catálogo por intenção (§21.1) — quais tools carregar para cada intenção (criar quadro, criar demanda, consultar, colaborar, admin, etc.)
- Política de confirmação alinhada a §4.4 e às `annotations`
- Códigos de erro e como o cliente deve reagir
- Aponta para `/mcp-docs` como documentação humana

---

## 6. Documentação por endpoint

Duas superfícies, geradas da MESMA fonte (o próprio `defineTool` — não duplica manualmente):

### 6.1 Página `/mcp-docs` (rebuild)
- Sidebar por domínio (17 grupos)
- Cada tool mostra: título, descrição, badges (`read-only`, `destructive`, `idempotent`), input schema (renderizado do Zod → JSON schema), exemplo de resposta (envelope), errors possíveis, `open_url` gerado.
- Busca por nome/domínio/annotation
- Endpoint público exibido no topo: `https://<ref>.supabase.co/functions/v1/mcp`
- Botão "Copiar como context.md" para o Orchestrator baixar o glossário do MCP

### 6.2 Arquivo estático `docs/mcp/context.md`
Gerado a partir do manifest, formato compatível com o `CONTEXT.md` do Orchestrator (glossário de termos + catálogo de tools + envelope + erros). O Orchestrator pode consumir esse arquivo diretamente no build.

Também gera `docs/mcp/README.md` humano e `docs/mcp/openapi-ish.json` (schema legível por LLMs, no formato JSON Schema).

---

## 7. Edge function `mcp`

- Regenerada pelo `mcpPlugin()` do Vite (nunca escrever à mão — o plugin bloqueia).
- Após edição, roda `app_mcp_server--extract_mcp_manifest` para regerar `.lovable/mcp/manifest.json` e valida.
- Deploy via `supabase--deploy_edge_functions(["mcp"])`.
- Confere OAuth via `supabase--debug_oauth_server` (consent path, issuer, redirect allow-list).
- Testa `whoami` autenticado via `supabase--curl_edge_functions`.

Nenhum outro edge function precisa ser criada — o MCP é auto-contido; `send-email`, `send-push-notification`, `check-deadlines` etc. já existem e são chamadas via triggers do banco quando o usuário conectado por MCP executa uma ação (respeita RLS + triggers do app).

---

## 8. Página `/oauth/consent` e Auth

Sem mudanças. Já está no padrão comprovado (CREATOR V4 / LEKPIS V3) com guard duplo em `supabase.auth.oauth` e preservação de `next` em senha + Google.

---

## 9. Testes de aceitação (validação sem erro)

Antes de fechar:

1. Manifest extraído sem erro; contagem de tools bate com o registro.
2. `curl` autenticado em `whoami`, `list_my_teams`, `list_boards`, `list_board_statuses`, `list_demands`, `get_operational_snapshot`, `create_demand` (com rollback via `archive_demand`).
3. Erro esperado para RLS: chamar `get_demand` de outro team → `PERMISSION_DENIED` com `recovery_options`.
4. Página `/mcp-docs` renderiza todos os domínios e a busca funciona.
5. `docs/mcp/context.md` existe e é lido corretamente.
6. Conexão do Orchestrator via `https://<ref>.supabase.co/functions/v1/mcp` → consent → tools descobertas → `whoami` OK.

---

## Escopo do que NÃO será feito nesta iteração

- **Eventos/webhooks para o Orchestrator (§25.8)**: exigem infra separada (fila, HMAC, `webhook_subscriptions` já existe mas precisa de emissores). Deixo como fase 2, com apenas o esqueleto de `list_webhook_subscriptions` read-only.
- **Créditos AI gateway** (§7 do CONTEXT): não é escopo do MCP do SoMA+, é do Orchestrator.
- **Alterar Auth.tsx / OAuthConsent.tsx** — já corretos.

---

## Sequência de execução (build mode)

1. `_shared/` (envelope, errors, urls, zod-common).
2. Reorganizar tools por pasta de domínio; migrar as 9 existentes primeiro (garante paridade).
3. Adicionar tools novas por domínio, em paralelo por arquivo.
4. Migração SQL: `aeiou_origin` em `demands`, colunas de upload em `demand_attachments`.
5. Reescrever `src/lib/mcp/index.ts` com todos os imports, `instructions` novo, auth OAuth (issuer direto).
6. Gerador de docs em `scripts/generate-mcp-docs.ts` → produz `docs/mcp/{context.md, README.md, schema.json}`.
7. Rebuild da página `/mcp-docs`.
8. `extract_mcp_manifest` → `deploy_edge_functions(["mcp"])` → `debug_oauth_server` → `curl` de smoke test.
9. Publicar (usuário clica em Publish para o painel Agent integrations refletir).

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Catálogo muito grande estoura contexto do LLM cliente | `instructions` orienta uso por intenção; `list_capabilities` permite filtragem |
| Regressão em tools existentes | Fase 2 recria as 9 originais primeiro e testa antes de adicionar novas |
| RLS bloqueando tools admin (planos, limites) | Usa `has_role`/`get_user_team_ids` security-definer já corrigidas; nunca cai em `service_role` |
| Timeout em tools pesadas (snapshot) | Consultas agregadas usam funções SQL security-definer criadas nas migrations, evitando N+1 no handler |

Confirma que posso executar esse plano?
