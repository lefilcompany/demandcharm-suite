# Camada de cache com Redis (Upstash)

## Objetivo
Reduzir o número de consultas repetidas ao banco para os dados mais lidos e mais estáveis: **serviços**, **perfis de usuários** e **etapas de quadro**. Hoje essas três fontes somam mais de 20 mil leituras, quase sempre retornando exatamente o mesmo conteúdo.

## Como vai funcionar
O aplicativo hoje consulta o banco direto do navegador, então o Redis precisa ficar atrás de uma função no servidor:

```text
Navegador  ->  função "cache"  ->  Redis (Upstash)
                     |  (quando não há cópia guardada)
                     +--------->  Banco de dados
```

- Primeira consulta: busca no banco, guarda a resposta no Redis e devolve.
- Consultas seguintes: devolve direto do Redis, sem tocar no banco.
- Quando alguém altera um serviço, um perfil ou uma etapa, a cópia guardada é apagada na hora, então ninguém vê dado velho.

## Etapas

1. **Conta Upstash** — você cria um banco Redis gratuito e salva as duas credenciais (endereço e token) no cofre de segredos do projeto.
2. **Função de cache no servidor** — nova função que atende três tipos de leitura (serviços por quadro/equipe, perfis por lista de IDs, etapas por quadro), sempre respeitando as permissões do usuário que fez o pedido.
3. **Invalidação automática** — ao criar, editar ou excluir serviço, perfil ou etapa, a cópia correspondente é removida do Redis.
4. **Ligar o app na nova rota** — os pontos do app que buscam esses três dados passam a chamar a função de cache, mantendo o comportamento atual em caso de falha (se o Redis estiver fora, busca direto no banco, sem quebrar nada).
5. **Ajuste do cache do navegador** — aumentar o tempo de reaproveitamento local desses mesmos dados (de 1 minuto para 10 minutos), o que já corta boa parte das chamadas antes mesmo de sair do navegador.
6. **Medição** — comparar o volume de consultas antes e depois para confirmar a redução.

## Detalhes técnicos

- **Provedor:** Upstash Redis via API REST (`@upstash/redis`), compatível com o runtime das edge functions. Segredos: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
- **Nova edge function `cache-read`**: valida o JWT do chamador, cria um client Supabase com o token do usuário (RLS preservada), e resolve por `resource`:
  - `services` → chave `svc:<team_id>:<board_id?>`, TTL 900s
  - `profiles` → chave `prof:<user_id>` (MGET por lote), TTL 600s
  - `board_statuses` → chave `bst:<board_id>`, TTL 900s
  - Chaves prefixadas com a versão do schema para permitir purge global.
- **Invalidação**: nova edge function interna `cache-invalidate` (chamada pelas mutações do front após sucesso) + `DEL` direto nos pontos de escrita já existentes (`useBoardStatuses`, gestão de serviços, atualização de perfil).
- **Camada no front**: helper `src/lib/cachedFetch.ts` com fallback para a query Supabase atual em caso de erro/timeout (500ms) da função; `useBoardServices`, `useBoardStatuses` e os hooks de perfis passam a usá-lo, com `staleTime` de 10 min e `gcTime` de 30 min no React Query.
- **Fora do escopo**: `demand_time_entries` (timers ao vivo) e listagem de demandas — permanecem em consulta direta.

## Observação
O ganho maior e imediato vem da etapa 5 (cache local mais longo); o Redis entra para compartilhar esse cache entre todos os usuários da mesma equipe, o que é o que realmente derruba o número de consultas no banco.
