# Sistema de Sprints por quadro

## O que o usuário vai ver
- Nova página **Sprints** na barra lateral (por quadro selecionado).
- Lista de sprints do quadro: nome, objetivo, início e fim, situação (Planejada, Ativa, Concluída).
- Detalhe da sprint:
  - **Kanban da sprint**: as mesmas colunas/etapas do quadro, só com as demandas da sprint, com arrastar entre etapas; no topo, barra entregues/total, dias restantes (ou "encerrada há X dias") e número de atrasadas.
  - **Lista por etapa**: demandas agrupadas pelo status atual do quadro, com prioridade, responsável e prazo; clique abre a demanda (botão do meio abre em nova aba).
- Ações (admin, coordenador e agente): criar/editar sprint, adicionar/remover demandas, iniciar e concluir.
- Ao concluir: oferecer mover as não entregues para a próxima sprint planejada (ou deixá-las sem sprint).
- Solicitantes só visualizam.
- No detalhe da demanda: selo com o nome da sprint atual.

## Regras
- Sprint pertence a um único quadro; só aceita demandas desse quadro.
- Uma demanda fica em no máximo uma sprint não concluída por vez.
- Só uma sprint **Ativa** por quadro ao mesmo tempo.
- Fim precisa ser igual ou depois do início.

## Detalhes técnicos
- Tabelas `board_sprints` (board_id, name, goal, start_date, end_date, status, created_by, timestamps) e `sprint_demands` (sprint_id, demand_id, added_by, added_at) com GRANTs, RLS usando `(select auth.uid())` + `is_board_member` para leitura e papel do quadro diferente de requester para escrita.
- Índice único parcial: uma sprint ativa por quadro. Trigger valida demanda do mesmo quadro e não presente em outra sprint aberta; datas validadas por trigger.
- RPC `complete_sprint(sprint_id, carry_to uuid)` SECURITY DEFINER (sem EXECUTE para anon) para concluir e mover pendentes.
- Hooks `useSprints`, `useSprint`, `useSprintDemands` (React Query, user id nas chaves); status vem de `board_statuses` filtrado por board_id; datas com `substring(0,10)`; estado de erro com "Tentar novamente".
- Página `src/pages/Sprints.tsx` em `/app/sprints`, item na sidebar, diálogos de criar/editar e de adicionar demandas (busca por título/número).
- Testes: regra de uma sprint aberta por demanda e cálculo de progresso/dias restantes.
