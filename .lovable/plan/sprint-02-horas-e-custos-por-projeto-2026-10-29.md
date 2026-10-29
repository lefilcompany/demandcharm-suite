# Sprint 02 — Horas e custos por projeto

Objetivo do guia: relatório por projeto com horas internas/externas, custo de pessoal e pendências, sem duplicidade e sem custo faltante escondido.

## O que o usuário vai ver

Nova aba **"Horas e custos"** dentro de "Base financeira do projeto" (e na tela de finanças do admin ao abrir um projeto), com seletor de mês:

1. **Resumo do mês:** horas internas, horas de cliente externo, horas de prestador, custo de pessoal, pessoas sem custo cadastrado (em destaque, nunca somado como zero silencioso).
2. **Por pessoa:** nome, vínculo (interno / cliente externo / prestador / sem vínculo), horas no projeto, custo/hora do mês, custo atribuído, aviso "sem custo" ou "sem vínculo".
3. **Auditoria de apontamentos:**
   - Timers sobrepostos (mesma pessoa, dois apontamentos ao mesmo tempo) — mostrados e contados uma vez só.
   - Apontamentos que cruzam a virada do mês — divididos automaticamente entre os dois meses, com etiqueta "dividido".
   - Timers ainda em andamento.
4. **Horas pendentes:** horas de demandas sem projeto definido (ligado à lista de pendências da Sprint 1, com "Atribuir aqui").
5. **Despesas:** lançamentos separados em **direta** e nos grupos **fixa / operacional / administrativa**; valores sem destino aparecem como "não alocado".
6. Exportação CSV do relatório para quem tem permissão de exportar.

Em "Lançamentos e acesso": o cadastro de custo mensal mostra o vínculo vigente da pessoa e avisa quando falta vínculo ou custo/hora no mês.

## Regras

- Hora vale para o mês em que foi trabalhada; um timer de 31/out 23h a 01/nov 01h conta 1h em cada mês.
- Sobreposição: no trecho em comum, a hora é contada uma única vez (dividida igualmente entre as demandas envolvidas), para não inflar custo.
- Projeto da hora = destino da demanda naquele mês (atribuição da Sprint 1); sem destino → "horas pendentes".
- Custo/hora = custo mensal ÷ horas produtivas do mês, conforme vínculo vigente; prestador e cliente externo aparecem separados das horas internas.
- Pessoa com horas e sem custo → custo marcado "faltante", nunca zero.
- Subdemandas contam no projeto da própria subdemanda.
- Só quem já tem acesso a custos individuais vê valores por pessoa; os demais veem só totais.

## Fora do escopo

Troca do motor/abas antigas de quadro para projeto (Sprint 03), API externa e fechamento por projeto (Sprint 04).

## Detalhes técnicos

- Migração aditiva:
  - `finance_expenses.expense_group` (`direct|fixed|operational|administrative`, default derivado de `expense_type`) com backfill.
  - Função interna `_finance_time_slices(team, competence)`: corta `demand_time_entries` na virada de mês (fuso America/Sao_Paulo), resolve sobreposição por usuário via janelas, junta com `finance_demand_attributions` e `finance_member_profiles` vigente.
  - RPC `get_project_hours_costs(project_id, competence)` (SECURITY DEFINER, checa `can_read_finance_structure` + permissão de custos individuais para linhas por pessoa) retornando resumo, pessoas, auditoria e pendências.
- Front: `src/lib/finance/timeSlices.ts` (puro: corte de mês, sobreposição, custo faltante) + testes com os casos do S2.5 (múltiplos quadros, externo, prestador, timers paralelos, mês cruzado, subdemanda); hook `useProjectHoursCosts`; componente `ProjectHoursCosts.tsx` no estilo "sala de operações"; campo de grupo no formulário de despesas.
- AGENTS.md: regra de corte por competência e deduplicação de sobreposição.
- QA: testes SQL no banco em LIMA TESTES com rollback + Playwright na nova aba.
