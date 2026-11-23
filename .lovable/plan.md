# Faturamento por projeto + aviso de novo projeto

## O que muda para o usuário
1. **Faturamento próprio de cada projeto** — cada projeto tem seus lançamentos de faturamento (mês, valor bruto, alíquota de NF, descrição), feitos na aba Faturamento da gestão financeira do projeto. Hoje o lançamento ainda exige escolher um quadro; ele passa a ser opcional, e o faturamento passa a pertencer ao projeto.
2. **Aviso quando um projeto é criado** — o dono da equipe e todos os gestores financeiros recebem:
   - aviso no sino do app: "Novo projeto criado: <nome> — configure o faturamento", que abre direto a aba Faturamento do projeto;
   - e-mail com o mesmo texto e um botão "Configurar faturamento".
   Quem criou o projeto não recebe o próprio aviso. Analistas e leitores não recebem, porque não podem lançar faturamento.
3. **Projeto sem faturamento sinalizado** — enquanto um projeto ativo não tiver faturamento no mês, o cartão dele em Gestão Financeira > Por projeto mostra "Faturamento não configurado", com atalho para configurar (só para quem pode editar).
4. **Faturamento geral da equipe** — no topo de Gestão Financeira aparece o total "Faturamento geral da equipe" do mês: a soma do faturamento de todos os projetos, com o bruto, a NF e o líquido, e a lista de quanto cada projeto contribui. Faturamento antigo lançado só por quadro, sem projeto, aparece numa linha separada, "Sem projeto", para que o total nunca conte nada duas vezes.

## Regras
- Lançar ou editar faturamento: dono e gestor financeiro. Analista e leitor só veem.
- Meses fechados continuam travados.
- Projetos inativos ficam fora do aviso de "não configurado", mas o faturamento que já tiveram continua no total.

## Detalhes técnicos
- Migração:
  - Em `finance_revenues`, `board_id` passa a aceitar vazio, com a regra de que `project_id` ou `board_id` tem que estar preenchido.
  - O RLS de `finance_revenues` passa a aceitar a autorização pelo projeto.
  - Nova RPC `get_team_revenue_summary(_team_id, _month)` (SECURITY INVOKER, só soma o que o usuário pode ver) devolve os totais por projeto mais a linha "sem projeto".
  - `_finance_project_month_live` passa a usar o faturamento pelo `project_id`. Faturamento por quadro só entra quando o lançamento não tem projeto, para não ser contado duas vezes.
- Aviso: o gatilho AFTER INSERT em `projects` chama uma função SECURITY DEFINER que encontra o dono da equipe (team_role admin) e os membros com `finance.manage_revenues` pelo perfil de acesso. Para cada destinatário, menos o criador, ela insere em `notifications` (type `project_created`, link `/app/projects/<id>/finance?aba=revenue`).
- E-mail: usa o envio que o app já tem (`send-email`, modelo notification), chamado pelo app logo depois de criar o projeto, com a lista de destinatários vinda de uma RPC. Falhas no e-mail não bloqueiam a criação do projeto e ficam registradas no log de envio. Não é preciso configurar nada novo.
- Frontend: `ProjectRevenue.tsx` (quadro opcional), `TeamProjectsFinance.tsx` (selo "não configurado"), novo cartão `TeamRevenueTotal` no topo de `Finance.tsx`, e a criação de projeto em `Projects.tsx` dispara os e-mails.
- Testes: um teste da soma (projetos + sem projeto, sem contagem dupla) e um teste SQL de que o dono e o gestor financeiro recebem o aviso, mas o criador e o analista não.
