# Nova aba "Por performance" na Gestão Financeira

## Objetivo
Mostrar, para cada performance (ex.: Plataformas, Conteúdo), quantos projetos ela tem, quanto fatura, quanto custa (hora/homem e demais custos) e qual o resultado — no mesmo período escolhido no topo da tela.

## Regra de contagem (importante)
- Cada projeto tem **uma** performance fixa, definida na criação. Os números de um projeto vão inteiros para a performance dele — nada é contado duas vezes.
- Uma pessoa pode estar em várias performances; o custo dela segue o projeto em que está alocada (como já é feito hoje), não a performance dela.
- Projetos antigos sem performance aparecem num grupo "Sem performance", para o total bater com o Sumário.
- Mesmas permissões das outras abas: só quem já vê a Gestão Financeira vê esta aba; nada de valor individual por pessoa.

## O que aparece na aba
1. **Cartões por performance** (no topo, com a cor da performance): nº de projetos (ativos / total), faturamento, custo total, resultado (verde/vermelho) e margem vs meta da equipe.
2. **Gráfico comparativo**: barras lado a lado por performance com Faturamento x Custo total, e o Resultado marcado.
3. **Composição do custo**: barra empilhada por performance — hora/homem, impostos, rateios de custos gerais.
4. **Horas**: previstas x reais por performance, com barra que fica vermelha quando passa do previsto.
5. **Participação**: rosca mostrando quanto cada performance representa do faturamento total da equipe.
6. **Tabela detalhada** (expansível): cada performance abre a lista dos seus projetos com os mesmos números; clicar no projeto leva ao financeiro dele.
7. Botão "Exportar Relatório" (CSV) com a tabela por performance, igual às outras abas.

## Ordem de entrega
1. Agrupamento dos números por performance + testes.
2. Aba com cartões, gráfico comparativo e tabela.
3. Gráficos de composição, horas e participação + exportação.
4. Conferência na tela com os dados de LIMA TESTES (Plataformas e Conteúdo), batendo os totais com o Sumário.

## Detalhes técnicos
- Nova entrada `byPerformance` em `SECTIONS` de `src/pages/Finance.tsx`, logo após `byProject`; componente `src/components/finance/PerformanceBreakdown.tsx`.
- Reaproveitar os mesmos resultados por projeto que já alimentam "Por projeto" (via `get_finance_overview` / engine) e agrupar no cliente por `projects.performance_id`, com nomes/cores de `team_performances` (hook já consolidado de performances). Sem nova tabela; só criar RPC agregadora se os dados por projeto não trouxerem horas previstas/reais — nesse caso ela respeitará a mesma checagem de acesso financeiro.
- Função pura `src/lib/finance/performanceRollup.ts` (soma em centavos, grupo "Sem performance", margem = resultado / receita líquida conforme engine) com testes: soma total = Sumário, projeto conta em uma só performance, grupo sem performance.
- Gráficos com Recharts, tokens de cor do tema e cor da performance; estados de erro com "Tentar novamente" (nunca mostrar vazio quando falhar).
