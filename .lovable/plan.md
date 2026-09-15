# Resumo IA com dados reais + resumo por participante

## O problema encontrado

Ao conferir os dados do quadro, encontrei a causa dos números que "não entram" no resumo:

- **976 demandas estão na etapa "Entregue" mas sem data de entrega registrada.** O resumo só conta como entregue quem tem essa data preenchida — então quase metade das entregas simplesmente não aparece, e por consequência "entregues dentro do prazo" fica muito abaixo do real.
- Demandas **criadas antes dos últimos 90 dias mas entregues dentro do período** ficam de fora da análise.
- O relatório lista em detalhe as atrasadas e as vencidas, mas **nunca lista as entregues no prazo** — só um número solto, o que passa a sensação de que o dado não está sendo considerado.

## O que vou fazer

### 1. Contagem de entregas correta

- Quando a demanda estiver na etapa "Entregue" sem data de entrega, usar a data da última mudança de etapa como data de entrega (com indicação de que é estimada).
- Passar a incluir no período qualquer demanda entregue nos últimos 90 dias, mesmo que tenha sido criada antes.
- Recalcular com isso: total entregue, entregues no prazo, atrasadas, vencidas, taxa de pontualidade, tempo médio e o desempenho de cada participante.

### 2. Entregas no prazo explícitas no relatório

- Nova lista "Entregues no Prazo" com título, data prevista, data de entrega, dias de antecedência e responsáveis — igual ao que já existe para atrasadas e vencidas.
- Nova seção no relatório gerado pela IA: **✅ Entregues no Prazo (Destaques)**, além do número na seção de métricas.
- Cartão de destaque na tela mostrando entregues no prazo x total com data definida.

### 3. Resumo por participante do quadro

- Seletor de participante no cabeçalho da tela Resumo IA: "Quadro inteiro" (padrão) ou um membro específico.
- Ao escolher um membro, a análise considera apenas as demandas em que ele é responsável ou seguidor, e o relatório passa a ser individual: volume, entregas no prazo x atrasadas, pontualidade, horas registradas, demandas vencidas em aberto, pontos fortes e recomendações.
- O resumo individual entra no mesmo histórico, exportação em PDF e link de compartilhamento já existentes, identificado pelo nome do participante.

## Detalhes técnicos

- `supabase/functions/board-summary/index.ts`: janela por `created_at` OU `delivered_at`; fallback `delivered_at ?? status_changed_at` quando a etapa é "Entregue"; novos campos `onTimeDetails`, `deliveredEstimatedCount`; parâmetro opcional `memberId` com filtro por `demand_assignees` e prompt alternativo individual.
- `src/pages/BoardSummary.tsx`: `Select` de participante (via `useBoardMembers`), envio de `memberId`, cartão de entregues no prazo, título contextual.
- `src/hooks/useBoardSummaryHistory.ts` e `board_summary_history`: guardar o participante analisado junto do registro.
- Sem alteração de dados no banco — a correção é no cálculo, não em gravação retroativa.
