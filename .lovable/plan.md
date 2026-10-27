# Inteligência Financeira — Fase 2: Custos, Produtividade e Rateios

Duas abas novas na tela: **Custos e Produtividade** e **Despesas e Rateios**. Os custos compartilhados passam a entrar no custo total de cada quadro, sem contar o mesmo valor duas vezes.

## 1. Custos e Produtividade
Para quem tem permissão de ver custos de pessoas (`view_employee_costs`):
- Tabela por pessoa e por mês: custo mensal, horas produtivas de referência, **custo/hora**, horas registradas no timer, **ocupação** (registradas ÷ referência) e horas sem quadro.
- Distribuição das horas de cada pessoa entre os quadros, mostrando quanto do custo dela foi para cada projeto.
- Alertas: pessoa sem custo cadastrado no mês (as horas dela ficam "sem custo"), ocupação acima de 100% e abaixo de 50%.

Para quem não tem essa permissão, a aba mostra só os totais da equipe: horas, custo agregado e ocupação média. Nenhum valor individual.

## 2. Despesas e Rateios
- Despesas ganham **tipo**: fixa, operacional ou administrativa.
- **Despesa direta**: ligada a um quadro, como já funciona hoje.
- **Despesa compartilhada**: sem quadro, dividida entre quadros por um critério escolhido no lançamento:
  - **Por horas**: na proporção das horas registradas em cada quadro no mês.
  - **Por receita**: na proporção do faturamento bruto do mês.
  - **Misto**: um % por horas e o resto por receita (ex.: 50/50).
  - Opcional: limitar o rateio a alguns quadros.
- Se nenhum quadro tiver base no mês (zero horas ou zero receita), o valor fica como "não rateado" e aparece em destaque, em vez de sumir.
- Prévia do rateio antes de salvar: quanto cada quadro recebe.
- Sem duplicar: cada despesa é direta ou compartilhada, nunca as duas. A soma do que cada quadro recebe é igual ao valor lançado, e os centavos que sobram do arredondamento vão para o maior quadro.

## 3. Reflexo nas abas existentes
- Visão Geral e Rentabilidade passam a separar **despesas diretas** de **rateio recebido**. Ambas entram no custo total e no resultado.
- No detalhe do quadro aparece de quais despesas compartilhadas veio o rateio.
- A exportação CSV ganha a coluna "Rateio".

## Visual
Segue o mesmo visual de "sala de operações" da Fase 1. O elemento marcante desta fase é a **barra de rateio**: cada despesa compartilhada aparece como uma faixa dividida entre os quadros, em tons de laranja a grafite, com o valor de cada parte ao passar o mouse. A parte não rateada fica hachurada. Na aba de custos, a ocupação usa uma régua fina com marcos em 50% e 100%.

## Acesso
- Mesmas permissões da Fase 1, sem novos papéis automáticos. Lançar despesa compartilhada exige `manage_expenses` no escopo da equipe.
- Quem só vê alguns quadros recebe o rateio desses quadros, sem ver a lista completa de despesas compartilhadas da equipe.

## Detalhes técnicos
- Migração aditiva em `finance_expenses`: `expense_type text default 'operacional'`, `allocation_method text` (null = direta; `hours` | `revenue` | `mixed`), `hours_weight numeric` (0–1, para misto) e `allocation_board_ids uuid[]` (opcional). Constraint: se `board_id` estiver vazio, `allocation_method` é obrigatório, e vice-versa. As linhas atuais continuam como diretas.
- Função pura `allocate()` em `src/lib/finance/allocation.ts`, com a mesma lógica em SQL dentro de `get_finance_overview`. O cálculo é feito na leitura, nada é gravado por quadro, então editar a despesa recalcula tudo. A função retorna as colunas novas `allocated_expenses` e `unallocated` (esta só no escopo da equipe).
- Nova RPC `get_finance_people(team, from, to)` SECURITY DEFINER: com `view_employee_costs`, devolve linhas por pessoa e quadro; sem ela, só agregados (nunca por pessoa). As horas vêm de `demand_time_entries`.
- Nova RPC `get_finance_allocation_detail(team, board, from, to)` para o detalhe do quadro, respeitando `can_view_finance_board`.
- `engine.ts` passa a somar o rateio ao custo total. Testes em `allocation.test.ts`: proporção por horas, por receita, misto 50/50, centavos fechando o total, base zero virando "não rateado" e filtro de quadros.
- Front: abas novas em `Finance.tsx`, `src/components/finance/CostsProductivity.tsx`, `ExpensesAllocation.tsx` e `AllocationBar.tsx`, e formulário de despesa em `FinanceManage.tsx` com tipo, critério e prévia.
- AGENTS.md: regra de que o rateio é calculado na leitura e cada despesa é direta ou compartilhada.
