# Performances: grupos de membros internos da equipe

## Objetivo
Trocar "Cargos da Equipe" por **Performances**: unidades/times criados pelo dono, formados só por **membros internos**. Uma pessoa pode estar em **uma ou mais** performances ao mesmo tempo.

## O que o usuário vai ver
- Na tela da equipe, o card "Cargos da Equipe" vira **Performances**: lista compacta com nome, cor, descrição e quantidade de pessoas, mais o botão "Criar performance".
- Ao abrir uma performance: editar nome/cor/descrição, ver os integrantes e adicionar/remover pessoas. O seletor mostra só membros internos (externos e solicitantes ficam de fora).
- No cartão de cada membro, o seletor de um único cargo vira **várias badges de performance**. O dono gerencia por um seletor com múltipla escolha.
- Os filtros que hoje usam "cargo" (Kanban, Demandas, Demandas da equipe, Projeto) passam a filtrar por performance. Entra quem está em qualquer uma das performances escolhidas.
- A busca de membros também encontra pessoas pelo nome da performance.
- Só o dono (e admins da equipe) cria, edita, exclui e aloca. Os demais membros só veem.

## Migração dos dados atuais
- Cada cargo existente vira uma performance com o mesmo nome, cor e descrição.
- Cada membro que tinha cargo é colocado na performance correspondente, mas só se for interno. Os externos ficam registrados no relatório da migração.
- O cargo antigo fica guardado e marcado como desativado, sem apagar nada, para que versões antigas abertas continuem funcionando.

## Regras garantidas pelo banco
- Só membro interno da mesma equipe pode entrar numa performance (trigger). A regra vale para app, assistente e API.
- Uma pessoa não pode ser adicionada duas vezes à mesma performance.
- Se a pessoa sai da equipe ou vira externa, ela sai das performances automaticamente.
- Nome da performance único dentro da equipe.

## Detalhes técnicos
- Tabelas novas: `team_performances` (id, team_id, name, description, color, text_color, created_by, created_at) e `team_performance_members` (performance_id, team_member_id, added_by, added_at, PK composta). Vêm com GRANTs, RLS (leitura para membros da equipe; escrita para dono/admin via helper SECURITY DEFINER, usando `(select auth.uid())`) e índices em team_id/team_member_id.
- Trigger `guard_performance_member_internal`: exige `team_members.member_kind = 'internal'` e o mesmo team_id. Trigger em `team_members` (DELETE / mudança de member_kind) para remover vínculos.
- Backfill a partir de `team_positions` + `team_members.position_id`, no mesmo migration. Deixar `COMMENT ... DEPRECATED` em `team_positions` e `team_members.position_id`, sem dropar.
- Hooks: `useTeamPerformances`, `usePerformanceMembers`, mutations (create/update/delete/add/remove) com invalidação. Chaves de query com teamId.
- `useMembersByPosition` vira `useMembersByPerformance(teamId, performanceIds[])` (mesma interface de retorno) e é usado em Kanban, Demands, TeamDemands e FolderDetail.
- `useTeamMembers` passa a trazer `performances[]` por membro. `MemberCard` ganha badges + multi-select.
- `TeamPositionsManager` vira `TeamPerformancesManager` (com sheet de integrantes). Ajustar TeamDetail/TeamConfig.
- MCP: `list_team_positions` vira `list_team_performances` (o antigo mantido como alias).
- Testes: regra "só interno", multi-performance e filtro por várias performances. Depois, conferir no Playwright: criar uma performance, alocar 2 pessoas, colocar a mesma pessoa em outra e filtrar o Kanban.
- Registrar a decisão em AGENTS.md.
