# Corrigir "não consigo pausar o timer" (conta antonio.menezes.ext@lefil.com.br)

## O que foi confirmado

Consultando o banco: essa conta tem **um único timer aberto** (sem `ended_at`), iniciado em **24/07/2026 20:28 UTC**, na demanda `dff2b807…` — a demanda **#0134 "[VÍDEO] App Cooperados"**, que é uma **demanda-pai com 2 subdemandas** (#0148 e #0135). As permissões (RLS) de atualização de time entries estão corretas, então não é bloqueio de banco.

Causa raiz: **demandas-pai não exibem controle de timer**.
- Na tela da demanda, quando existem subdemandas o app troca o bloco com botão de play/pause pelo resumo "TEMPO TOTAL (SUBDEMANDAS)", que é só leitura (confirmado no print enviado).
- No Kanban, o card da demanda-pai usa `hideIfHasSubdemands`, escondendo o botão de pausar.

Resultado: o único ponto de pausa é o card em "Timers Ativos" na barra lateral. Clicando na área do card (que é um link), o app **navega para a demanda** — e lá não existe botão de pausar. Daí a sensação de "clico para parar e ele só me leva para a demanda sem parar", e o timer segue contando há semanas.

## Correções

1. **Mostrar o controle de pausa também em demandas-pai**
   - Tela da demanda: exibir o bloco de tempo pessoal com botão pausar/iniciar mesmo quando há subdemandas (mantendo o resumo de tempo das subdemandas acima).
   - Kanban: quando o usuário atual tiver um timer rodando naquela demanda, não esconder o controle, mesmo com subdemandas.

2. **Tornar o botão de pausar da barra lateral confiável**
   - Aumentar a área de clique e garantir `preventDefault` + `stopPropagation`, para que nunca caia na navegação do link.
   - Nunca deixar o botão em estado `disabled` por carregamento de leitura (botão desabilitado deixa o clique "vazar" para o link do card); usar apenas indicador de carregamento durante a pausa.

3. **Robustez ao parar o timer**
   - Se existirem múltiplos registros abertos do mesmo usuário na demanda, fechar todos (hoje a consulta espera um único registro e falharia).
   - Se o update não fechar nenhum registro, mostrar mensagem de erro clara em vez de sucesso silencioso.

4. **Encerrar o timer preso da conta (opcional, sob confirmação)**
   - O registro aberto desde 24/07 acumularia ~17 dias. Posso encerrá-lo com a duração ajustada para um valor realista (ex.: o tempo até o fim daquele dia de trabalho) ou com a duração cheia — você escolhe. Também posso apenas deixar que a própria usuária pause pela interface corrigida.

## Detalhes técnicos

- `src/pages/DemandDetail.tsx`: renderizar `UserTimeTrackingDisplay` (com controles) junto do `ParentDemandTimeDisplay` quando a demanda tiver subdemandas.
- `src/components/KanbanTimeDisplay.tsx`: `hideIfHasSubdemands` passa a não ocultar quando `isTimerRunning` do usuário atual for verdadeiro.
- `src/components/SidebarActiveTimers.tsx`: handler com `preventDefault`/`stopPropagation`, botão fora do `NavLink` com hit area maior e sem `disabled` durante leituras.
- `src/hooks/useUserTimeTracking.ts` (`useStopUserTimer`): trocar `maybeSingle()` por listagem de todos os registros abertos e fechar cada um; validar linhas afetadas.

## Verificação

- Abrir a demanda #0134 e conferir que aparece o botão de pausar do timer pessoal.
- Pausar pela barra lateral e confirmar que o card some sem navegar.
- Conferir no banco que não restam registros com `ended_at` nulo para a conta.
