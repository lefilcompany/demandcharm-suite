# Roadmap

- [x] Criar tabela de solicitações de demonstração.
- [x] Criar envio público de solicitação com e-mail para o time comercial.
- [x] Criar landing page pública SoMA+ sem preços.
- [x] Criar gestão administrativa das solicitações.
- [x] Verificar funcionamento e corrigir erros pendentes.
- [x] Landing na raiz e sistema em /app, com redirecionamento dos endereços antigos.


## Cache compartilhado (Redis/Upstash)
- [x] Funcoes cache-read e cache-invalidate + helper src/lib/cachedFetch.ts
- [x] Servicos, etapas de quadro e perfis lendo via cache com fallback direto ao banco
- [x] Salvar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para ativar o Redis (testado: 2ª chamada vem do cache)

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
- [ ] Implementar busca semântica funcional (embeddings + pgvector) sobre demandas/notas
