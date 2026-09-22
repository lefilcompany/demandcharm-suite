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
- [ ] Salvar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para ativar o Redis
