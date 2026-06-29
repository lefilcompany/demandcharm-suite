## Objetivo

Insights personalizados **por usuário + quadro**, focados nas demandas em que o usuário é responsável (`is_primary = true`) ou acompanhante (follower) em `demand_assignees`. Gerados **uma única vez por dia** (24h a partir da primeira geração) e salvos no servidor, compartilhados entre dispositivos/sessões do mesmo usuário.

## Comportamento

- Ao abrir o dashboard do quadro, o app chama `dashboard-ai-insights`.
- Backend procura registro em `user_board_ai_insights` para `(user_id, board_id)`.
  - Se `expires_at > now()` → retorna os insights salvos (sem chamar Gemini).
  - Senão → coleta dados personalizados do usuário, chama Gemini, faz UPSERT com `expires_at = now() + 24h` e retorna.
- Sem variação de "is_requester": o conteúdo é determinado pelas demandas do próprio usuário no quadro.

## Dados coletados por usuário no quadro

A função coletará apenas demandas do `board_id` em que o `user_id` é:
- responsável (`demand_assignees.is_primary = true`), OU
- acompanhante (`demand_assignees.is_primary = false`), OU
- (fallback legado) `demands.assigned_to = user_id` ou `demands.created_by = user_id`.

Para cada demanda, calcula:
- **Atrasadas e não entregues**: `due_date < now()` e não está em status "Entregue".
- **Vence hoje**: `due_date::date = current_date` e não entregue.
- **Vence em até 3 dias** (próximas do prazo): `due_date` entre hoje e hoje+3 dias, não entregue.
- **Entregues no prazo / com atraso** nos últimos 30 dias.
- **Em ajuste** (status "Em Ajuste").
- **Aguardando aprovação** (status com `adjustment_type='internal'`).
- Distribuição por status e por serviço (apenas das demandas do usuário).
- Papel do usuário no quadro (`board_members.role`) para ajustar o tom (admin/moderator vs executor vs requester).

O resumo enviado ao Gemini deixará explícito:
- Nome do quadro
- Papel do usuário
- Contagens acima (responsável vs acompanhante separadas)
- Lista curta (máx 5) dos títulos mais críticos: atrasadas + vencendo hoje + vencendo em 3 dias

## Mudanças técnicas

### Migration

Nova tabela:

```text
user_board_ai_insights
  id uuid pk
  user_id uuid not null  -> referencia conceitual a auth.users
  board_id uuid not null fk boards(id) on delete cascade
  insights jsonb not null
  generated_at timestamptz not null default now()
  expires_at timestamptz not null
  UNIQUE (user_id, board_id)
```

- `GRANT SELECT ON public.user_board_ai_insights TO authenticated;`
- `GRANT ALL ON public.user_board_ai_insights TO service_role;`
- RLS habilitada.
- Policy `SELECT`: `user_id = auth.uid()` (cada usuário só vê os próprios insights).
- Sem policies de INSERT/UPDATE/DELETE para `authenticated` — escrita feita pela edge function com service role.
- Índice em `(user_id, board_id)` (já garantido pela UNIQUE) e `(expires_at)` para limpezas futuras.

### Edge function `dashboard-ai-insights`

Reescrita para:
1. Autenticar o usuário (igual hoje).
2. Validar membership no `board_id`.
3. Selecionar `user_board_ai_insights` por `(user_id, board_id)`.
   - Se `expires_at > now()`, devolver `insights` salvos.
4. Caso contrário:
   - Buscar `board_members.role` do usuário no quadro.
   - Buscar demandas do quadro onde o usuário aparece em `demand_assignees`, `assigned_to` ou `created_by`, com `archived = false`, trazendo `due_date`, `delivered_at`, `is_overdue`, `status_id`, `demand_statuses(name, color)`, `services(name)`, `demand_assignees(user_id, is_primary)`, `title`.
   - Calcular as métricas descritas acima (separando responsável vs acompanhante).
   - Montar `summaryText` personalizado com nome/role do usuário e listas críticas.
   - Chamar Gemini com prompt que enfatiza:
     - foco no usuário (não em métricas globais do quadro),
     - usar separação entre "responsável" e "acompanhante",
     - destacar prazos atrasados e prazos próximos,
     - 3 insights, mesmo schema atual (`title`, `description`, `type`).
   - Fazer UPSERT em `user_board_ai_insights` com `expires_at = now() + interval '24 hours'`.
   - Retornar `{ insights }`.
5. O parâmetro `is_requester` deixa de afetar a lógica (continua aceito por compatibilidade, mas ignorado).

### Frontend `src/components/DashboardAIInsights.tsx`

- Remover toda a lógica de cache em `localStorage` (`CACHE_PREFIX`, fingerprint, listeners de auth para limpar cache, leitura/escrita do cache).
- `useQuery` simples (`queryKey: ["dashboard-ai-insights", boardId, userId]`) chamando `supabase.functions.invoke("dashboard-ai-insights", { body: { board_id } })`.
- `staleTime: 5 * 60_000`, `gcTime` razoável; sem `Infinity`. Backend é a fonte de verdade do TTL de 24h.
- Manter tratamento de 401/402/429 que já existe.
- Efeito único para limpar entradas legadas no `localStorage` com prefixo `soma:ai-insights:`.

## Critérios de aceitação

- Dois usuários do mesmo quadro veem insights **diferentes**, baseados nas próprias demandas.
- O mesmo usuário vê os mesmos insights por 24h (independente de logout, troca de dispositivo ou reload).
- Após 24h da primeira geração diária, a próxima abertura dispara nova análise e novo ciclo de 24h.
- Usuário sem demandas no quadro recebe insights informativos (ex: "Você não possui demandas atribuídas neste momento") sem erro.
- Acessos a outro quadro onde o usuário não é membro continuam retornando 403.
