# Cache das demandas sem risco de dado velho

## Objetivo
A lista de demandas é a consulta mais pesada do sistema (quadro inteiro, com etapa, serviço, criador, responsável e seguidores). Ela também é a que mais muda. A ideia é reaproveitar a resposta entre todos os usuários do mesmo quadro, mas de um jeito em que **qualquer alteração invalida a cópia guardada na hora** — o banco continua sendo a fonte da verdade.

## Como garantir que ninguém veja dado antigo
Em vez de confiar em tempo de expiração, cada quadro passa a ter um **número de versão** guardado no próprio banco. Esse número sobe automaticamente sempre que alguma demanda do quadro é criada, alterada, movida de etapa, arquivada, ou quando muda responsável/seguidor.

```text
Navegador -> função "demandas"
                |-- lê a versão atual do quadro no banco (consulta minúscula)
                |-- procura no Redis a cópia daquela versão exata
                |     achou  -> devolve na hora
                |     não achou -> consulta a lista completa, guarda e devolve
```

Como a chave do cache carrega a versão, assim que alguém mexe em qualquer demanda a versão muda e a chave antiga simplesmente deixa de ser consultada. Não existe janela de dado velho: no pior caso o cache é ignorado e a consulta vai direto ao banco.

Além disso, o aviso em tempo real que o app já usa (quando alguém move um cartão) continua atualizando a tela dos outros usuários imediatamente.

## Etapas

1. **Contador de versão por quadro** — nova tabela pequena com uma linha por quadro e gatilhos no banco que sobem o contador a cada mudança em demanda, responsável ou etapa.
2. **Função de leitura das demandas** — nova rota no servidor que confere a versão, procura a cópia guardada e, se não houver, busca no banco e guarda.
3. **Ligar a tela do quadro nessa rota** — Kanban, lista de demandas e visão por pasta passam a usar a rota, mantendo o comportamento atual (offline e falha continuam consultando direto o banco).
4. **Ajuste dos tempos locais** — o reaproveitamento no navegador continua curto, já que a versão é quem manda.
5. **Medição** — comparar o volume de consultas ao banco antes e depois.

## Detalhes técnicos

- **Versão**: tabela `public.board_cache_versions (board_id uuid pk, demands_version bigint default 1, updated_at timestamptz)`, com GRANTs (`select` para `authenticated`, `all` para `service_role`) e RLS de leitura para membros do quadro. Gatilhos `AFTER INSERT/UPDATE/DELETE` em `demands`, `demand_assignees` e `board_statuses` chamam uma função `bump_board_demands_version(board_id)` que faz upsert com `demands_version = demands_version + 1`. Para `demand_assignees` o `board_id` vem por lookup da demanda.
- **Edge function `demands-read`**: valida o JWT, cria client com o token do usuário (RLS preservada), lê `demands_version` do quadro (1 query indexada, ~1 ms), monta a chave `dmd:<board_id>:v<version>` e usa o `redisCache.ts` já existente. TTL de segurança de 120s (só para limpar chaves órfãs de versões antigas). Miss → executa exatamente o mesmo `select` de `useDemands` e grava.
- **Autorização**: a checagem de acesso ao quadro é sempre feita com o token do chamador antes de devolver qualquer conteúdo; o cache guarda só o conteúdo, nunca a permissão. Como a política de demandas pode variar por papel (solicitante vê menos), a chave inclui o papel do usuário no quadro: `dmd:<board_id>:<board_role>:v<version>`.
- **Frontend**: `src/lib/cachedFetch.ts` ganha o recurso `demands` (mesmo circuit breaker: 3 falhas → 60s desligado, timeout 1,2s, fallback para a query atual). `useDemands` (`src/hooks/useDemands.ts`) passa a chamar `cachedRead({ resource: "demands", boardId }, fallbackQuery)`, mantendo o caminho offline (`getCachedDemandsByBoard`) intacto. `staleTime` segue em 60s; `useRealtimeDemands` continua invalidando as chaves do React Query.
- **Fora do escopo**: `useAllTeamDemands` (multi-quadro, paginado) e `demand_time_entries` (timers ao vivo) permanecem em consulta direta.

## Risco controlado
Se o Redis estiver fora do ar ou lento, tudo cai automaticamente na consulta direta ao banco — nenhuma tela quebra e nada fica desatualizado.
