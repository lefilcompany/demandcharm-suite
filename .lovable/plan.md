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
