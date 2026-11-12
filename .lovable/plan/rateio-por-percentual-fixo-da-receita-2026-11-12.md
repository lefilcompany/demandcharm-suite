# Rateio por percentual fixo da receita

## Problema
Hoje uma despesa compartilhada é dividida inteira entre os quadros, proporcional a horas/receita. Quando entra um novo contrato, a parte de todos cai — o novo paga menos e os antigos mudam de valor.

## Como vai funcionar
- Novo método de rateio: **"Percentual fixo da receita"** (ex.: 8%).
- Cada quadro/contrato absorve `percentual x faturamento bruto do mês` dele, até o limite da despesa — independente de quantos contratos existam.
- O percentual fica **travado por despesa**: um contrato novo não altera o valor cobrado dos antigos.
- A diferença entre a despesa real e o total absorvido aparece separada:
  - Se faltar: **"Custo não absorvido"** (prejuízo de estrutura, visível na Visão geral e Rateios).
  - Se sobrar (mais contratos que o previsto): **"Folga de rateio"** (margem extra da empresa), sem reduzir a cobrança de ninguém.
- Os métodos atuais (horas, receita, misto) continuam disponíveis; despesas já cadastradas não mudam.
- Meses fechados continuam intocados (fotografia + ajustes).

## Telas
- Cadastro de despesa compartilhada: opção "Percentual fixo da receita" + campo de %.
- Aba Rateios: coluna com % aplicado e linhas "Não absorvido" / "Folga".
- Simulador: mostra quanto um novo contrato absorveria com o % travado.

## Detalhes técnicos
- Migração: `finance_expenses.allocation_method` aceita `revenue_pct`; nova coluna `allocation_pct numeric` (CHECK 0–100, obrigatória só para esse método).
- `_finance_allocations` (SQL) e `src/lib/finance/allocation.ts` espelhados: para `revenue_pct`, `amount_board = round(gross * pct/100, 2)`; se a soma passar da despesa, a cobrança se mantém e o excedente vira `surplus`; se faltar, vira `unallocated`. Saída ganha `surplus`.
- `get_finance_overview` / `_finance_project_month` expõem `unallocated` e `surplus`.
- Testes: 3 contratos + 1 novo mantém o valor dos 3 antigos; o novo paga o mesmo %; cálculo de falta/folga; arredondamento.

---

# Valores padrão da equipe e preço mínimo do contrato

## O que muda
- Nova área **"Valores padrão"** em Finanças (só Gestor financeiro edita): alíquota de imposto, meta de margem, desconto máximo, percentual de rateio padrão e valor da hora/homem (geral e, opcionalmente, por cargo).
- Cada valor tem **"vale a partir de"**: mudar o padrão não reescreve meses ou projetos antigos.
- Ao **incorporar um quadro a um projeto**, o SoMA+ copia esses padrões para as configurações do projeto. Depois o projeto pode ajustar os seus sem afetar os padrões.
- **Simulador de preço do projeto** ganha o card **"Preço mínimo a cobrar"**:
  `preço mínimo = (horas estimadas x hora/homem) / (1 - imposto - rateio % - custo variável - meta)`, mostrando também o efeito do desconto máximo. Avisa quando os percentuais somam 100% ou mais.

## Detalhes técnicos
- Nova tabela `finance_team_defaults` (team_id, valid_from, tax_rate, margin_target, max_discount, allocation_pct, variable_rate, hourly_cost, hourly_cost_by_position jsonb), com grants + RLS via `has_finance_permission`; trigger de auditoria existente.
- Trigger em `project_boards`: cria `finance_project_settings` (que já tem tax_rate, variable_rate, margin_target) a partir do padrão vigente, só se o projeto ainda não tiver configuração.
- `src/lib/finance/pricing.ts` puro: `minimumPrice()` + testes (percentuais ≥ 100%, desconto, arredondamento).
- Registrar as duas tarefas em `roadmap.md` ao iniciar a implementação.
