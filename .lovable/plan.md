# Proteção contra avalanche de consultas no cache das demandas

Hoje, quando o cache falha ou expira, todas as telas abertas caem direto no banco ao mesmo tempo. Em escala isso vira gargalo. O objetivo é garantir que, num mesmo instante, apenas uma consulta pesada chegue ao banco por quadro — as demais esperam e reaproveitam o resultado.

## O que muda na prática

- Quando muitas pessoas abrem o mesmo quadro ao mesmo tempo, só a primeira consulta o banco; as outras recebem a mesma resposta em seguida.
- Se o cache demora, o sistema entrega a última cópia conhecida (levemente anterior) em vez de sobrecarregar o banco, e atualiza logo em seguida.
- Se o cache cair por completo, o sistema continua funcionando, mas limitando quantas consultas pesadas vão ao banco por vez.
- O banco continua sendo a fonte da verdade e ninguém vê dado errado depois de uma alteração: qualquer mudança em demanda, responsável ou etapa continua trocando a versão da chave.

## Mudanças técnicas

### 1. Lock distribuído + coalescência (`supabase/functions/demands-read/index.ts`)

No caminho de miss:
1. Tentar `SET lock:<chave> NX EX 10` no Redis.
2. Ganhou o lock -> consulta o banco, grava o resultado e libera o lock.
3. Não ganhou -> faz polling curto na chave (até ~1,5 s, intervalos de 100 ms). Se a chave aparecer, devolve do cache.
4. Passou o tempo de espera -> consulta o banco como hoje (último recurso), mas com uma trava por instância limitando o número de consultas simultâneas.

### 2. Cópia de segurança (stale-while-revalidate) no `_shared/redisCache.ts`

- Além da chave versionada com TTL de 120 s, gravar uma chave `stale:demands:<quadro>:<papel>` com TTL longo (10 min), sem número de versão.
- Quem não consegue o lock e não vê a chave fresca dentro do tempo de espera recebe a cópia `stale` com `stale: true` na resposta, em vez de bater no banco.
- A cópia stale só é usada quando a versão gravada nela é igual à versão atual do banco; versão diferente significa dado alterado e aí a leitura vai ao banco.
- Novos helpers: `cacheAcquireLock`, `cacheReleaseLock`, `cacheGetWithMeta`, `cacheSetWithMeta`.

### 3. Menos leituras da versão

- Guardar `demands_version` em cache no Redis por 5 s por quadro, para não ler a tabela de versões a cada request.
- O trigger de bump continua no banco; o TTL de 5 s limita a janela a alguns segundos apenas para o número de versão, não para os dados.

### 4. Circuit breaker compartilhado (`_shared/redisCache.ts`)

- Contador de falhas do Redis guardado em memória por instância da função (como hoje no frontend) mais uma chave Redis `health:redis` para sinalizar degradação entre instâncias quando o Redis volta parcialmente.
- Enquanto degradado, as funções pulam o Redis e usam apenas a trava de concorrência local ao ir ao banco.

### 5. Frontend (`src/lib/cachedFetch.ts`)

- Coalescência no cliente: um mapa de promessas em andamento por chave, para que várias telas/hooks no mesmo navegador não disparem chamadas paralelas idênticas.
- Aumentar `CACHE_TIMEOUT_MS` de 600 ms para 1200 ms nas demandas, para dar tempo ao caminho de espera do lock antes de cair no fallback direto.
- Jitter aleatório (0–250 ms) antes do refetch em massa, evitando que todos os clientes reabram ao mesmo tempo após um evento de invalidação.

## Validação

- Teste de carga simples: disparar 30 chamadas simultâneas a `demands-read` no mesmo quadro após invalidar a chave e conferir nos logs que houve apenas 1 consulta ao banco.
- Conferir que, após alterar uma demanda, a próxima leitura já reflete a mudança (sem stale indevido).
- Playwright no Kanban com sessão, verificando carregamento normal e ausência de erros no console.
