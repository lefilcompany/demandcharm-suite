# Limpeza da visão do projeto financeiro

## O que muda para você
- Ao abrir um projeto em Finanças (admin), aparece só aquele projeto — a tela geral da equipe deixa de ser repetida embaixo.
- Topo único: Voltar, nome do projeto, equipe, selo do mês (Aberto / Fechado / Fechado + ajustes), um único seletor de mês e Exportar CSV.
- Uma única faixa escura com 5 números: Faturamento, Custo da equipe, Rateios, Resultado e Margem com a régua da meta. Aviso de custo incompleto vira uma linha discreta abaixo.
- Abaixo, abas: **Visão geral** (composição por quadro e despesas), **Equipe e horas** (tabela única de pessoas; sobrepostos/divididos/em andamento viram etiquetas pequenas no topo da tabela), **Quadros e pendências**, **Configuração**.
- A mesma organização vale dentro da página do projeto (pasta), para as duas telas ficarem iguais.

## Detalhes técnicos
- Criar `ProjectFinanceView` (topo + faixa + abas) reaproveitando os dados de `ProjectFinanceSummary`, `ProjectHoursCosts` e `ProjectFinancePanel`; mês controlado num só lugar, usando `MonthRangeField`/seletor de mês único em vez do `type="month"` nativo.
- `ProjectFinanceSummary` e `ProjectHoursCosts` ganham modo "corpo" (sem faixa escura própria); KPIs saem só da faixa principal.
- `AdminFinance.tsx`: ao abrir um projeto, renderizar só `ProjectFinanceView`; `<Finance>` continua apenas para cartões "Sem projeto".
- `ProjectFinancePanel` (FolderDetail) passa a usar `ProjectFinanceView`.
- Nenhuma mudança no banco ou nos cálculos. Conferir no navegador em 1167×674.
