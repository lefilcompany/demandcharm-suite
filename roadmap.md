# Roadmap

## Documentos no assistente
- [ ] Anexar documentos no chat e reutilizar análise/revisão da importação, mantendo o quadro atual.
- [ ] Conferir análise real, seleção e confirmação de criação.

## Ampliação das ferramentas do assistente
- [x] Consultas de riscos, capacidade, histórico, serviços, tempo, documentos, duplicidades, fluxo e relatórios.
- [x] Criação/edição de demandas, comentários, ações em lote e planejamento de sprint com confirmação explícita.
- [x] Catálogo de todas as ferramentas disponíveis, cinco testes e verificação na conversa real (catálogo, riscos, confirmação e comentário salvo).

## Leitura completa das novidades
- [x] Abrir o texto completo da novidade ao clicar no sino ou no aviso in-app, sem sair da tela atual.
- [x] Conferir leitura e fechamento com uma notificação real; 9 testes passando, incluindo o acesso separado à funcionalidade anunciada.

- [x] Criar tabela de solicitações de demonstração.
- [x] Criar envio público de solicitação com e-mail para o time comercial.
- [x] Criar landing page pública SoMA+ sem preços.
- [x] Criar gestão administrativa das solicitações.
- [x] Verificar funcionamento e corrigir erros pendentes.
- [x] Landing na raiz e sistema em /app, com redirecionamento dos endereços antigos.
- [x] Substituir a landing da rota inicial pela LP-SOMA+ 1:1, com imagens, fontes, animações e rolagem completas.


## Cache compartilhado (Redis/Upstash)
- [x] Funcoes cache-read e cache-invalidate + helper src/lib/cachedFetch.ts
- [x] Servicos, etapas de quadro e perfis lendo via cache com fallback direto ao banco
- [x] Salvar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para ativar o Redis (testado: 2ª chamada vem do cache)
- [x] Demandas com cache versionado pelo banco: `board_cache_versions` + triggers (demands, demand_assignees, board_statuses), edge function `demands-read`, chave `demands:<board>:<papel>:v<versão>` (TTL 120s só p/ limpeza). Testado: cached=false → true; após alterar uma demanda, versão sobe e o cache é ignorado

## Assistente do quadro (tool calling)
Decisões: uma conversa por quadro, guardada no navegador (localStorage), com botão "Nova conversa".
Módulo profundo único de métricas no banco (`board_demand_facts` + `get_board_metrics`) — todas as
definições (aberta, entregue no prazo/atrasada, vencida, vence em breve, etapa, responsável) vivem em um lugar só.
- [x] Migração: `board_demand_facts(board_id)` e `get_board_metrics(board_id, from, to, member_id)`
- [x] Edge Function `board-agent` (Lovable AI, tool calling: métricas, listar demandas, membros, solicitações)
- [x] Página `/app/board-agent` com chat, sugestões de perguntas, atividade das ferramentas e markdown
- [x] Item "Assistente do Quadro" no menu lateral (+ redirecionamento do endereço antigo)
- [x] MCP `board_summary_stats` passa a usar `get_board_metrics` (mesmas definições)
- [x] Verificar com perguntas reais no quadro de teste: catálogo e riscos respondidos; comentário interno aprovado e salvo.
- [x] Revisar tom e regras de confirmação do assistente.
- [ ] Opcional: histórico da conversa na nuvem (hoje fica só no navegador)
- [ ] Opcional: usar `get_board_metrics` também no Resumo IA (`board-summary`) para eliminar as fórmulas duplicadas restantes

## Pendências
- [ ] Comparar pg_stat antes/depois do Redis para medir o ganho
- [ ] Confirmar deploy em produção das edge functions que usam `/app/`: process-platform-events, processReleaseEmailDeliveries, detect-production-release, generate-release-notes, ingest-release-event


## Busca semântica
- [x] Índice `search_documents` (pgvector 768d, HNSW) + `match_board_documents` / `search_index_status`
- [x] Edge functions `semantic-index` (indexa demandas, solicitações, membros e serviços via Gemini) e `semantic-search`
- [x] Grupo "Por significado" na busca global do topo, escopo do quadro atual
- [ ] Opcional: reindexação agendada (hoje reindexa sob demanda quando o índice tem mais de 10 minutos)
- [ ] Opcional: incluir notas e comentários no índice


## Latência (banco, permissões e anexos)
- [x] Índices `team_members(user_id)` e `team_members(team_id)`
- [x] Policies de `profiles`, `demands`, `board_members`, `team_members` usando `(select auth.uid())` — perfis: ~503 ms → ~21 ms; demandas: ~0,5 ms
- [x] `REVOKE EXECUTE` de `anon` nas funções internas (gatilhos, manutenção, métricas, busca semântica)
- [x] Links de anexos assinados em lote com cache em memória (`useAttachments.ts`)
- [x] Circuit breaker do cache externo mais rígido (600 ms / 2 falhas / 120 s)
- [ ] Observar crescimento de rollbacks do Postgres (hoje acumulado desde o boot, sem ação)

## Atualização do app sem Ctrl+Shift+R (service worker)
Causa: o worker guardava a página inicial junto com 930 arquivos (32 MB, ~75 s) e a servia do cache;
a hospedagem apaga os arquivos da versão anterior a cada publicação → 404 + tela em branco.
- [x] Worker próprio `src/sw.ts` (injectManifest): página sempre da rede, cópia só como reserva offline
- [x] Precache só com JS/CSS/ícones/fontes; pacotes pesados (shiki/mermaid) em `assets/lazy/` fora do precache
- [x] `/assets/*` com CacheFirst gravando no precache (recupera instalação parcial/cache apagado)
- [x] Modal de atualização não apaga mais os caches; recuperação de chunk ausente ativa o worker novo e recarrega
- [x] `AppErrorBoundary` para nunca ficar em tela branca
- [ ] Publicar e confirmar no endereço oficial que abrir rotas não exige mais Ctrl+Shift+R (testado localmente: instalação 75 s → ~2 s; 930 arquivos/32 MB → 224/8 MB; página nova após publicação; offline abre; prompt de atualização OK)

## Projetos "sumiram" para um usuário (2026-10-09)
Diagnóstico: nenhum projeto apagado (14 na LeFil Company, sem exclusões desde 10/09); donos ainda na equipe/quadros; RLS e grants corretos.
Causa provável no navegador: o worker guardava TODAS as respostas do backend por URL (sem usuário) por 24 h e as usava quando a rede passava de 10 s.
- [x] Worker: só `/rest/v1/` GET, NetworkFirst sem timeout, chave por usuário (`swApiCache.ts`), anônimo nunca guardado; cache antigo apagado no activate
- [x] `useDemandFolders`: user id na chave do React Query
- [x] Tela Projetos e faixa de projetos: estado de erro com "Tentar novamente" (nunca "Nenhum projeto" em falha)
- [x] Faixa de projetos: aviso "Nenhum projeto neste quadro · N em outros quadros" com atalho para ver todos
- [x] Verificado: build local + Playwright (2 contas no mesmo navegador, backend fora do ar: cada conta recebe só a própria cópia; anônimo nunca guardado); tela de erro com retry; aviso na faixa
- [ ] Publicar; o usuário afetado aceita o aviso "Novidades no SoMA!" (ou fecha e reabre o app) — o worker novo apaga a cópia antiga por URL

## Kanban vazio (demandas em etapas que o quadro não mostra)
- [x] Causa: demandas recorrentes e etapas desativadas deixavam demandas fora de qualquer coluna (187 demandas em 16 quadros; 3 pessoas com 100% das suas demandas do Magalu invisíveis)
- [x] Banco: toda gravação de demanda cai numa etapa ativa do quadro; reparo das 187 demandas e dos modelos recorrentes sem disparar notificações
- [x] Desativar etapa com demandas pede o destino e move tudo de uma vez
- [x] Kanban mostra erro com "Tentar novamente" quando a leitura falha e aviso "Limpar filtros" quando os filtros escondem tudo
- [x] Verificado: Hub LeFil mostra as recorrentes no Backlog; bloqueio e troca de etapa testados no banco (sem gravar)
- [ ] AGUARDA DECISÃO DO USUÁRIO — Data de entrega (`delivered_at`) não é gravada em quadros com etapa "Entregue" própria (1.115 de 2.014 entregues sem data) — a regra dos 31 dias não as oculta e métricas de prazo ficam incompletas
