# Faturamento por projeto + aviso de novo projeto

## O que muda para o usuário
1. **Só o faturamento é por projeto** — na aba Faturamento do projeto, você informa apenas o mês, o valor bruto e uma descrição. Não é preciso escolher um quadro nem uma alíquota.
   - Alíquota de NF, rateio, margem, custos fixos, operacionais e administrativos e hora/homem são **gerais da equipe**. Eles ficam em Gestão Financeira > Custos/Valores padrão, e todo projeto usa esses mesmos valores automaticamente.
   - Os ajustes por projeto (alíquota, rateio e margem próprios) saem da tela do projeto, que passa a mostrar esses valores só para leitura, com "Valores da equipe".
2. **Aviso quando um projeto é criado** — o dono da equipe e todos os gestores financeiros recebem:
   - aviso no sino do app: "Novo projeto criado: <nome> — configure o faturamento", que abre direto a aba Faturamento do projeto;
   - e-mail com o mesmo texto e um botão "Configurar faturamento".
   Quem criou o projeto não recebe o próprio aviso. Analistas e leitores não recebem, porque não podem lançar faturamento.
3. **Projeto sem faturamento sinalizado** — enquanto um projeto ativo não tiver faturamento no mês, o cartão dele em Gestão Financeira > Por projeto mostra "Faturamento não configurado", com atalho para configurar (só para quem pode editar).
4. **Faturamento geral da equipe** — no topo de Gestão Financeira aparece o total "Faturamento geral da equipe" do mês: a soma do faturamento de todos os projetos, com o bruto, a NF e o líquido, e a lista de quanto cada projeto contribui. Faturamento antigo lançado só por quadro, sem projeto, aparece numa linha separada, "Sem projeto", para que o total nunca conte nada duas vezes.

## Regras
- Lançar ou editar faturamento: dono e gestor financeiro. Analista e leitor só veem.
- Meses fechados continuam travados.
- Quando a equipe muda um valor geral, por exemplo a alíquota, todos os projetos passam a usar o novo valor nos meses abertos; meses fechados não mudam.
- Projetos inativos ficam fora do aviso de "não configurado", mas o faturamento que já tiveram continua no total.

## Detalhes técnicos
- Migração:
  - Em `finance_revenues`, `board_id` passa a aceitar vazio, com a regra de que `project_id` ou `board_id` tem que estar preenchido.
  - O cálculo do projeto (`_finance_project_month_live`) passa a ler alíquota, variáveis, rateio e margem sempre de `finance_team_defaults` (versão vigente no mês), ignorando `finance_project_settings` (marcado como DEPRECATED, sem apagar). O `tax_rate` da linha de faturamento deixa de ser usado para lançamentos novos.
  - O RLS de `finance_revenues` passa a aceitar a autorização pelo projeto.
  - Nova RPC `get_team_revenue_summary(_team_id, _month)` (SECURITY INVOKER, só soma o que o usuário pode ver) devolve os totais por projeto mais a linha "sem projeto".
  - `_finance_project_month_live` passa a usar o faturamento pelo `project_id`. Faturamento por quadro só entra quando o lançamento não tem projeto, para não ser contado duas vezes.
- Aviso: o gatilho AFTER INSERT em `projects` chama uma função SECURITY DEFINER que encontra o dono da equipe (team_role admin) e os membros com `finance.manage_revenues` pelo perfil de acesso. Para cada destinatário, menos o criador, ela insere em `notifications` (type `project_created`, link `/app/projects/<id>/finance?aba=revenue`).
- E-mail: usa o envio que o app já tem (`send-email`, modelo notification), chamado pelo app logo depois de criar o projeto, com a lista de destinatários vinda de uma RPC. Falhas no e-mail não bloqueiam a criação do projeto e ficam registradas no log de envio. Não é preciso configurar nada novo.
- Frontend: `ProjectRevenue.tsx` (só mês, valor e descrição; sem quadro e sem alíquota), `ProjectFinancePanel.tsx` (configurações do projeto viram só leitura, "Valores da equipe"), `TeamProjectsFinance.tsx` (selo "não configurado"), novo cartão `TeamRevenueTotal` no topo de `Finance.tsx`, e a criação de projeto em `Projects.tsx` dispara os e-mails.
- Testes: um teste de que dois projetos com a mesma receita usam a mesma alíquota da equipe; um teste da soma (projetos + sem projeto, sem contagem dupla) e um teste SQL de que o dono e o gestor financeiro recebem o aviso, mas o criador e o analista não.
