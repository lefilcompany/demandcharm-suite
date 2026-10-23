# Painel do admin com identidade própria

Hoje o painel é a montagem padrão: seis cartões iguais, gráfico de área, rosca e listas soltas. A proposta é tratá-lo como uma **sala de operações do SoMA+**: o administrador entende em segundos se a plataforma está crescendo e o que precisa de atenção hoje. Os dados e consultas continuam os mesmos.

## Direção visual

- **Cores da marca, mais nada**: grafite #1D1D1D, laranja #F28705, branco, além de um cinza quente (#8A847C) e um âmbar escuro (#B45309) só para alertas. Sem verde/roxo/rosa aleatórios nos gráficos: os planos aparecem em tons de laranja → grafite.
- **Tipografia**: os números grandes em fonte condensada (Barlow Condensed, peso 600, com algarismos alinhados). Rótulos pequenos em fonte mono (JetBrains Mono, caixa alta, espaçamento largo), que dão o tom de "painel de instrumentos". O resto do texto continua na fonte do app.
- **Elemento marcante**: uma **faixa de comando** em grafite no topo, com os números principais (Equipes, Usuários, Assinaturas, Demandas) em tamanho grande, separados por linhas finas e não por cartões. Embaixo de cada número fica uma régua fina laranja com o crescimento dos últimos 30 dias. É o único lugar com fundo escuro e números grandes; o resto da tela fica sóbrio.

## Nova organização

```text
+--------------------------------------------------------------+
| FAIXA DE COMANDO (grafite)                                   |
| EQUIPES 128 | USUÁRIOS 1.204 | ASSINATURAS 42 | DEMANDAS 9k  |
| +6 em 30d ▬ | +38 em 30d ▬▬  | 12 em trial    | cupons: 3    |
+--------------------------------------------------------------+
| PRECISA DE ATENÇÃO (trials que vencem em 7 dias)             |
| linha do tempo horizontal: hoje -> +7d, equipes como marcas  |
+-------------------------------------+------------------------+
| Crescimento - 6 meses               | Planos ativos          |
| barras: usuários (laranja)          | barra horizontal       |
| equipes (grafite)                   | empilhada + legenda    |
+-------------------------------------+------------------------+
| Entraram por último: equipes e usuários em um só feed,       |
| com data relativa ("há 2 dias") e selo do plano              |
+--------------------------------------------------------------+
```

- **Precisa de atenção** sobe para perto do topo: é o que pede ação. Quando nada está vencendo, vira uma linha discreta "Nenhum trial vence nos próximos 7 dias".
- **Crescimento**: troca o gráfico de área por barras lado a lado por mês, mais fáceis de comparar.
- **Planos**: troca a rosca por uma única barra horizontal dividida, com o número de equipes de cada plano.
- **Feed único** de chegadas recentes no lugar das duas listas separadas, com links "Ver equipes" / "Ver usuários".
- Animação só na entrada: os números da faixa contam até o valor uma vez (desligada para quem prefere menos movimento).
- Funciona no celular: a faixa vira grade 2x2 e a linha do tempo vira lista.

## Detalhes técnicos

- Arquivos: `src/pages/admin/AdminDashboard.tsx` dividido em `src/components/admin/dashboard/` (CommandStrip, TrialTimeline, GrowthBars, PlanSplitBar, ArrivalsFeed).
- Novos tokens em `src/index.css` / `tailwind.config.ts`: `--ops-ink`, `--ops-muted`, `--ops-alert`, escala `--plan-1..5` derivada do primary; fontes `font-display-condensed` e `font-mono-label` via Google Fonts em `index.html`. Nenhuma cor fixa nos componentes.
- O feed junta `recentTeams` e `recentUsers` de `useAdminDashboardData` no cliente e ordena por `created_at`; hooks e consultas ficam como estão.
- Também remove os `<SEOHead>` repetidos dentro de cartões e linhas (hoje aparecem várias vezes).
- Verificação com Playwright logado como admin do sistema, em 1167x674 e no celular.
