# Custos da equipe por projeto ativo + ativação de projetos

## Como a planilha funciona
- **Custos de todos os clientes**: três valores mensais da equipe — custo fixo (R$ 8.800), operacional (R$ 10.000) e administrativo sem imposto de NF (R$ 14.000). Cada um é dividido pela quantidade de clientes/projetos (12), e o resultado é o rateio de cada projeto (ex.: 8.800 ÷ 12 = R$ 733,33).
- **Hora/homem**: custo da pessoa para a empresa ÷ horas contratadas (2.000 ÷ 220 = R$ 9,09/h). O custo de RH entra pelas horas gastas, e não pelo rateio. Isso já existe no app.
- **Cliente**: faturamento mensal do projeto, menos NF 21%, margem 40%, menos as três parcelas do rateio.
- Marketing e comercial ficam fora dos custos dos projetos.

## O que muda para você

### 1. Aba "Lançamentos" vira "Custos"
- No topo ficam três cartões: **Custo fixo**, **Custo operacional** e **Custo administrativo**. Cada um tem um valor mensal que vale até alguém mudar, sem lançar mês a mês.
- Um quadro de divisão mostra, para cada custo: valor total ÷ projetos ativos = **valor por projeto**. Depois vem o total por projeto e a lista dos projetos ativos que estão dividindo.
- Um aviso lembra que marketing e comercial não entram nos custos e que o custo das pessoas entra pelas horas.
- A parte de receitas e despesas lançadas por quadro sai desta aba. "Pessoas" (hora/homem), "Valores padrão" e "Acesso" continuam como seções dentro de Custos.
- Só o dono e o gestor financeiro editam os custos. Analista e leitor só veem.

### 2. Faturamento passa a ser por projeto
- Na tela de Gestão financeira de cada projeto, o faturamento mensal fica com imposto e descrição, e deixa de ser uma configuração geral.
- O resultado do projeto passa a ser: faturamento − impostos − horas das pessoas − sua parte dos três custos.

### 3. Ativar e inativar projetos
- Cada projeto ganha a situação **Ativo/Inativo**, que aparece nos cartões de Projetos e na tela do projeto, com um botão para trocar e uma confirmação.
- Quem pode trocar: o dono da equipe e o perfil "Gestor de projetos".
- Só projetos ativos entram na divisão dos custos. Ao inativar um projeto, a parte de cada projeto restante aumenta a partir daquele mês.
- **Quadros de um projeto inativo ficam somente leitura para todos.** Não dá para criar demanda, abrir solicitação, mudar status nem contar tempo. Um aviso no topo do quadro explica o motivo.
- Exceção: se o quadro também estiver em outro projeto ativo, ele continua funcionando normalmente.
- Ao reativar o projeto, tudo volta a funcionar.

### 4. Rateios antigos
- A aba "Rateios" passa a mostrar a divisão por projeto ativo.
- As despesas compartilhadas já lançadas (como "fegrhtyj") continuam no histórico, mas os meses novos usam a nova regra.

## Detalhes técnicos
- **Banco de dados**
  - Nova tabela `finance_team_costs`: equipe, tipo (fixo, operacional ou administrativo), valor mensal, válido a partir de um mês, com versão e auditoria. Inclui GRANT, RLS (leitura com `finance.view_team`, escrita com `finance.manage_settings`) e o trigger `finance_audit_trigger`.
  - `projects` ganha a coluna `status` (padrão `active`) e a nova tabela `project_status_history` (projeto, status, desde quando), para contar os projetos ativos em cada mês.
  - A RPC `set_project_status` confere se quem chama é o dono ou tem o perfil Gestor de projetos e registra o histórico.
- **Rateio**: a função `_finance_project_cost_share(team, month)` calcula custo ÷ projetos ativos no mês (ativo em algum momento do mês, com corte no horário de São Paulo). O cálculo é feito só pelo banco, com uma cópia simples em `src/lib/finance/projectShare.ts` para a tela.
  - `_finance_project_month` e `_finance_overview_all` passam a usar essa parcela em vez de `_finance_allocations` nos meses abertos.
  - Meses fechados continuam usando o snapshot.
- **Faturamento**: `finance_revenues` ganha a coluna `project_id`, que fica opcional para não quebrar o histórico. A tela do projeto lança o faturamento com o projeto preenchido.
- **Bloqueio de projeto inativo**
  - A função `is_board_frozen(board)` retorna verdadeiro quando todos os projetos do quadro estão inativos.
  - Triggers BEFORE recusam com `BOARD_FROZEN` o INSERT em `demands` e `demand_requests`, o UPDATE de status em `demands` e o INSERT/UPDATE em `demand_time_entries`. Assim o bloqueio vale para qualquer tela, assistente ou API.
  - No app, o hook `useBoardFrozen` mostra o aviso e desabilita os botões de criar, de arrastar no Kanban e o timer.
- **Testes**
  - Teste unitário da divisão: 8.800 ÷ 12 = 733,33, e com 11 ativos = 800,00.
  - O e2e financeiro ganha um caso que inativa um projeto e confirma que a divisão sobe e que criar demanda no quadro dele é recusado.
- **AGENTS.md**: substituir a regra de despesas compartilhadas pela nova regra de custo por projeto ativo e registrar o bloqueio de quadros pelo banco.
