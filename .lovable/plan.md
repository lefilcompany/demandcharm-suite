# Inteligência Financeira — Fase 1

Cada **quadro** é tratado como um projeto. Entregamos em fases; esta fase traz a base segura e as duas primeiras abas.

## O que existe hoje e será reutilizado
- Papéis: `user_roles` (admin global), `team_members` (owner/member), `board_members` (admin/moderator/executor/requester).
- Horas: `demand_time_entries` (usuário, demanda, início/fim, duração) — fonte única das horas realizadas.
- Horas previstas: `services.estimated_hours` / `hours_min`/`hours_max` das demandas do quadro.
- Jornada: `user_work_schedules` (horas disponíveis por colaborador).
- Não existe cadastro de cliente: o nome do quadro faz esse papel nesta fase.
- Regra de "Entregue congelada" fica intacta: nada desta fase escreve em `demands`.

## O que entra na Fase 1
1. **Permissões financeiras** (capacidades complementares, não papéis): concedidas por escopo equipe ou quadro, com quem concedeu/revogou e quando. Ninguém recebe automaticamente — nem owner nem admin de quadro. Solicitantes nunca acessam.
2. **Custo do colaborador por mês**: custo mensal completo + horas produtivas de referência; custo/hora calculado. Mês fechado não muda retroativamente.
3. **Faturamento por quadro e mês** (bruto, alíquota — padrão 21%) e **despesas diretas** por quadro.
4. **Configuração da equipe**: meta de margem (padrão 40%), alíquota padrão, com exceção por quadro.
5. **Motor de cálculo único** com testes (fórmulas do documento; margem "indisponível" quando faturamento = 0; status Rentável / Atenção / Prejuízo / Sem dados).
6. **Tela "Inteligência Financeira"** no menu (só aparece para quem tem permissão), com abas:
   - **Visão Geral**: faturamento, impostos, receita líquida, custo total, resultado e margem; evolução mensal; ranking e quadros abaixo da meta; desvio de horas previstas x realizadas.
   - **Rentabilidade por Projeto**: tabela por quadro com ordenação, detalhe do quadro, colunas conforme permissão (custo agregado da equipe sem salários individuais para quem não tem `view_employee_costs`).
   - Filtros: competência, equipe, quadro — só opções autorizadas.
   - Exportação CSV só com `finance.export`.
7. **Tela de cadastro** (para quem tem permissão de gestão): custos de colaboradores, faturamento, despesas e permissões.

## Fases seguintes
- Fase 2: Custos e Produtividade + Despesas e Rateios (fixo, operacional, administrativo; por horas, receita ou misto, sem duplicar).
- Fase 3: Fechamento mensal com simulação e ajustes auditáveis + Simulador de Precificação com cenários salvos.

## Visual
Segue a identidade da "sala de operações" já usada no painel admin: faixa grafite com números em Barlow Condensed, rótulos em JetBrains Mono, laranja #F28705 só para o que pede atenção. Elemento marcante: uma **régua da meta** em cada quadro — barra da margem realizada com o marco de 40% riscado, mostrando o desvio em pontos percentuais. Valores em R$, datas brasileiras, estados de carregando/erro/sem dados, tooltips nos indicadores.

## Detalhes técnicos
- Tabelas novas (todas com `team_id`, `board_id` quando aplicável, RLS + GRANTs, `(select auth.uid())`): `finance_permissions` (+ `finance_permission_log`), `finance_settings`, `finance_employee_costs` (user_id, competência, valores), `finance_revenues`, `finance_expenses`, `finance_audit_log`.
- Função `has_finance_permission(_user, _perm, _team, _board)` SECURITY DEFINER: exige membresia na equipe; para escopo de quadro exige `board_members` não-requester; admin global via `has_role`. Concessão/revogação só via RPC que valida quem concede (owner com `finance.manage_settings` ou admin global); usuário não concede a si mesmo.
- Agregação no backend: RPC `get_finance_overview(team, month_from, month_to, board?)` retorna só quadros autorizados; custos individuais nunca saem sem `view_employee_costs`. Totais da equipe só com `view_team`.
- Motor puro em `src/lib/finance/engine.ts` (espelhado na RPC) + `engine.test.ts`; testes de RLS em SQL simulando requester, executor, moderator sem permissão, outra equipe e export sem permissão.
- Front: `src/pages/Finance.tsx`, `src/components/finance/*`, hook `useFinancePermissions`, rota protegida `/app/finance`, item no menu condicionado.
- AGENTS.md: regra da camada de permissões financeiras e de "quadro = projeto".
