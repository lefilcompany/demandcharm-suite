# Roadmap

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
- [ ] Verificar com uma pergunta real no quadro de teste — BLOQUEADO: limite de créditos de IA do workspace atingido (403 credit_limit_reached); precisa de ação do administrador do workspace
- [ ] Depois de liberar créditos: revisar o tom das respostas e ajustar o prompt se necessário
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
