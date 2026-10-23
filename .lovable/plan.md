# Dashboard do quadro com a mesma identidade do painel do admin

Hoje o dashboard (/app) abre com uma foto genérica de banco de imagens e um texto de marketing ("Gestão Inteligente de Demandas"). Abaixo dele vêm cartões que parecem soltos entre si. A proposta é usar a linguagem de "sala de operações" do painel do admin, ajustada para o dia a dia de quem trabalha no quadro: ao abrir, a pessoa vê **como está o quadro hoje** e o que precisa da atenção dela.

## O que muda

- **A faixa do quadro entra no lugar do banner com foto.** É um bloco grafite com o nome do quadro e a data de hoje, além de 4 números grandes:
  - Em andamento
  - Atrasadas
  - Entregues no mês
  - Minhas abertas

  Cada número tem uma régua laranja fina. O botão "Personalizar" fica no canto da faixa. Para quem só solicita demandas, os números passam a ser Pendentes, Em andamento, Entregues e Uso do escopo (por exemplo, 12/40).
- **Insights da IA:** viram uma faixa de leitura mais discreta, com o rótulo "Leitura da IA" e o texto em corpo normal. Saem o fundo colorido e os ícones decorativos.
- **Cartões de produtividade, demandas, membros e atividades:** ganham o mesmo padrão de título e rótulo da tela do admin. Os títulos ficam curtos, com um rótulo pequeno em fonte de painel (por exemplo, "Mês · 30 dias"). As bordas, sombras e espaçamentos passam a ser iguais em todos.
- **Gráficos:** usam só tons de laranja a grafite. Saem o azul, o roxo e o verde aleatórios. O vermelho ou âmbar ficam reservados para atraso.
- **Números grandes:** passam a usar a fonte condensada do painel do admin, com os números contando até o valor ao abrir a página. A animação fica desligada para quem pediu menos movimento no aparelho.
- **Tamanhos de tela:** no seu tamanho (1167x674), a faixa ocupa no máximo cerca de 130 px de altura, para sobrar espaço para o conteúdo. No celular, os números ficam em grade 2x2.

```text
+--------------------------------------------------------------+
| QUADRO TESTES · sex 23/10                    [Personalizar]  |
| EM ANDAMENTO 14 | ATRASADAS 3 | ENTREGUES NO MÊS 41 | MINHAS 5 |
+--------------------------------------------------------------+
| LEITURA DA IA  "3 demandas vencem amanhã; Fazendo está..."   |
+-------------------------------+------------------------------+
| Produtividade                 | Demandas                     |
+-------------------------------+------------------------------+
| Membros                       | Atividades recentes          |
+--------------------------------------------------------------+
```

Os dados, os filtros, a escolha de quais blocos aparecem e as permissões continuam iguais. Só muda a aparência e a ordem visual.

## Detalhes técnicos

- Novo `src/components/dashboard/BoardCommandStrip.tsx`, que reutiliza `CommandStrip`/`OpsLabel` de `components/admin/dashboard/OpsParts.tsx`. Esses dois componentes passam para `src/components/ops/`, que vira a base compartilhada das duas telas.
- Os números da faixa são calculados de `useDemands(selectedBoardId)`, que já está carregado em `Index.tsx`: atrasadas pelo `due_date` comparado com hoje (via `substring(0,10)`), entregues pelo `delivered_at` do mês e "minhas" pelos responsáveis. O escopo do solicitante vem de `useCanCreateDemandOnBoard`.
- `DashboardBanner` deixa de ser usado no `Index.tsx`. Ele continua existindo caso outra tela ainda o use.
- O padrão visual é aplicado em `DashboardAIInsights`, `ProductivitySection`, `DemandsSectionCard`, `MemberAnalysisSection` e `RecentActivities`, só nas classes e cores dos gráficos, sem tocar na lógica.
- Teste curto para a contagem de atrasadas e de entregues no mês.
- Verificação com Playwright logado como a sua conta, em 1167x674 e no celular.
