# Sprint 1 — Fundamentos: projeto como centro financeiro

Meta do guia: deixar de tratar "quadro = projeto". Um projeto passa a agrupar vários quadros, e cada demanda do mês tem um único destino financeiro ou fica marcada como pendente. As telas do dia a dia continuam como estão.

## Decisões adotadas (S1.2, conforme recomendações do guia)
- **Projeto = centro financeiro; quadro = agrupador do dia a dia.** Um projeto pode ter vários quadros; um quadro pode estar em mais de um projeto, com histórico (início/fim do vínculo).
- **Atribuição automática:** se o quadro da demanda pertence a exatamente um projeto ativo naquele mês, a demanda vai para ele automaticamente. Se pertence a zero ou a vários, a demanda fica **pendente de classificação**.
- **Um destino por demanda por mês.** Aparecer em várias pastas/projetos continua permitido para organização, mas só um projeto recebe as horas.
- **Vínculo do membro por equipe e período:** interno, externo do cliente ou prestador. Independente do papel (dono/membro/solicitante). Sem vínculo cadastrado = "não classificado", nunca custo zero.
- **Dados financeiros atuais (lançamentos, cenários, fechamentos por quadro) não são migrados nem apagados** nesta sprint; a passagem para projeto fica para a Sprint 3.
- **Unidade financeira:** o projeto ganha um campo de código da unidade e uma chave estável para integração, ainda sem uso externo.
- Essas decisões ficam registradas como um documento curto de decisão no próprio projeto.

## O que muda nas telas (S1.4)
- **Projetos:** cada cartão mostra os quadros vinculados e um aviso de "X demandas sem projeto financeiro".
- **Detalhe do projeto:** nova seção "Quadros vinculados" (vincular/desvincular com data), "Configuração financeira inicial" (código da unidade, ativo/inativo) e lista de demandas pendentes do mês com ação "Atribuir a este projeto".
- **Inteligência Financeira > Lançamentos e acesso:** nova lista "Vínculo dos membros" para marcar cada pessoa como interno, externo do cliente ou prestador, com data de início.
- Só quem tem permissão financeira de gestão altera vínculos de quadros, atribuições e vínculo de membros; os demais apenas veem (sem valores).

## Testes (S1.5)
- Quadro em 1 projeto → nova demanda atribuída sozinha.
- Quadro em 2 projetos ou em nenhum → demanda pendente.
- Tentativa de dar dois destinos à mesma demanda no mesmo mês é recusada.
- Externo e usuário sem permissão não conseguem ler nem alterar vínculos.
- Demandas e lançamentos existentes continuam intactos após a mudança.

## Detalhes técnicos
- **S1.1 Inventário:** relatório (em arquivo de decisão) das tabelas/funções `finance_*` em produção, RLS e dados legados por `board_id`, com rollback (todas as mudanças são aditivas).
- **Migração aditiva:**
  - `projects`: `finance_enabled bool default false`, `integration_key uuid default gen_random_uuid() unique`, `unit_external_id text null`.
  - `project_boards(project_id, board_id, valid_from date, valid_to date null, created_by)`; índice parcial único impede o mesmo quadro duas vezes ativo no mesmo projeto; trigger valida mesma equipe e períodos sem sobreposição.
  - `finance_demand_attributions(demand_id, competence date (1º dia do mês), project_id null, status 'auto'|'manual'|'pending', reason, decided_by)`; único por `(demand_id, competence)`.
  - `finance_member_profiles(team_id, user_id, kind 'internal'|'client_external'|'contractor', valid_from, valid_to, created_by)` com trigger de não sobreposição e auditoria em `finance_audit_log`.
  - Trigger em `demands` (AFTER INSERT e troca de quadro) chama `finance_auto_attribute_demand`; RPCs `finance_assign_demand(demand, competence, project)` e `finance_pending_demands(team, competence)` com checagem de `has_finance_permission`.
  - GRANTs + RLS com `(select auth.uid())`; leitura por membros da equipe com acesso ao projeto, escrita só via permissão financeira de gestão; solicitantes excluídos.
- Backfill: atribuir demandas do mês corrente onde a regra é inequívoca; restantes ficam `pending`.
- Front: hooks `useProjectBoards`, `useFinanceAttributions`, `useMemberProfiles` (chaves com user id); edição em `Projects.tsx`/detalhe do projeto e `FinanceManage.tsx`; lógica pura de resolução em `src/lib/finance/attribution.ts` com testes.
- AGENTS.md: regra "projeto é o centro financeiro; destino único por demanda/competência no banco".
