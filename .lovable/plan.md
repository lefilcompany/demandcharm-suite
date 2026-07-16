# Enxugar MCP para o Marketing OS Shell

## Contexto

O projeto "Marketing OS Orchestrator" (Shell) consome o Soma via MCP como app do pilar **O — Operações**. Conforme o PRD (§ Soma, linhas 1733-1743) e o CONTEXT.md, o Shell precisa apenas de: **projetos, tarefas, responsáveis, datas, status, aprovações, dependências, anexos** — mais o fluxo de **identidade → equipe → quadros → quadro ativo** que você pediu.

Hoje o MCP expõe ~99 tools em 16 arquivos (1816 linhas). Muita coisa (analytics pesado, timer, notas, templates, share-links públicos, catálogo de serviços) não é usada pelo Shell e polui o catálogo do agente orquestrador, aumentando tokens e chance de erro.

## O que mantenho (essencial para o Marketing OS Shell)

| Arquivo | Papel no fluxo do Shell |
|---|---|
| `session.ts` | `whoami`, `get_user_profile`, `update_my_profile` — identidade após login |
| `teams.ts` | `list_my_teams`, `get_team`, `list_team_members`, `join_team_with_code`, `get_plan_limits` — usuário escolhe a equipe |
| `boards.ts` | CRUD de quadros, membros, status — usuário escolhe o quadro ativo e opera |
| `demands.ts` | Tarefas: listar/buscar/criar/editar/status/atribuições/dependências/subdemandas/mover |
| `subtasks.ts` | Checklist dentro da tarefa |
| `comments.ts` | Colaboração no contexto do ciclo AEIOU |
| `attachments.ts` | Anexos (item explícito do PRD) |
| `projects.ts` | Projetos Soma (RF-O-002: criar/atualizar projetos autorizados) |
| `requests.ts` | Solicitações/aprovações (item explícito do PRD) |
| `notifications.ts` | Feedback do orquestrador para o usuário |

## O que removo do registro do MCP

Arquivos que **não** correspondem a nenhum requisito do Soma no PRD, e cujos dados o Shell não orquestra:

- `analytics.ts` — sumários/produtividade; U-pillar tem seu próprio Agente de Unificação
- `time.ts` — start/stop timer e apontamentos manuais (não listado no PRD para Soma)
- `services.ts` — catálogo de serviços internos do Soma
- `notes.ts` — notas pessoais/compartilhadas
- `templates.ts` — templates + recorrentes (automação vive em outros pilares)
- `sharing.ts` — tokens de compartilhamento público por link

Removo apenas os **imports/registros** em `src/lib/mcp/index.ts`. Os arquivos permanecem no repo (não são deletados) — assim é fácil reativar no futuro, e nada quebra na UI do app Soma (que não usa esses arquivos, só o servidor MCP faz).

## Ajuste no `defineMcp`

`src/lib/mcp/index.ts`:
- Remover os 6 imports acima e as respectivas entradas em `allTools`.
- Reescrever `instructions` refletindo o escopo enxuto e o fluxo esperado pelo orquestrador: "após autenticar, chame `whoami`; para escolher contexto de trabalho, use `list_my_teams` → `list_boards` (com `team_id`) → memorize `board_id` para as chamadas seguintes de demandas/projetos".
- Manter `auth.oauth.issuer(...)` como está (OAuth Supabase já configurado, sem mudanças).
- Manter `name`, `version`, mudar `title` para algo como "SoMA — Operações (Marketing OS)".

## Validação e deploy

Depois de salvar `index.ts`:
1. Rodar `app_mcp_server--extract_mcp_manifest` para regenerar `.lovable/mcp/manifest.json` e confirmar que o catálogo enxuto compila sem erro.
2. Rodar `supabase--deploy_edge_functions` com `function_names: ["mcp"]` para publicar o servidor MCP atualizado, senão clientes já conectados continuam vendo o catálogo antigo.

Sem migração de banco, sem mudança de UI, sem tocar em RLS: as ferramentas mantidas já respeitam a autenticação do usuário e você continua podendo escolher equipe/quadro exatamente como no app.

## Resultado

Catálogo reduz de ~99 → ~55 tools, ~1225 linhas expostas (queda de ~33%), e o orquestrador do Marketing OS recebe só o que precisa para o fluxo Estratégia → Operações descrito no PRD.
