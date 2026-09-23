# Reduzir latência: banco, permissões e anexos

Plano baseado em verificações feitas agora no banco de produção. Cada item abaixo foi confirmado antes de entrar aqui.

## O que foi confirmado

- `team_members` **não tem índice por usuário** (só por `id` e pelo par `equipe+usuário`, nessa ordem). Toda checagem de permissão que pergunta "de quais equipes esse usuário participa" varre a tabela inteira — já são 33 milhões de varreduras acumuladas.
- `user_roles` já tem índice por usuário; as 4,8 milhões de varreduras ali são de uma tabela minúscula (40 kB), então esse ponto **não é o gargalo** que parecia ser. Não vou "corrigir" o que não está quebrado.
- As regras de acesso de `profiles` chamam a identificação do usuário logado linha a linha, em vez de uma vez por consulta.
- 25 funções internas do banco estão executáveis por visitantes **não logados**, incluindo funções de gatilho e de manutenção (limpeza de avisos, conversão de subdemanda em solicitação, atualização de versão de cache). Nenhuma delas deveria ser acessível de fora.
- A tabela de avisos continua a maior do sistema (23 MB, 59 mil linhas), mesmo após a limpeza diária já criada.

## O que vai ser feito

### 1. Índices que aceleram todas as telas
Criar índice por usuário em `team_members` (e um complementar por equipe). Isso corta as varreduras completas que hoje acontecem dentro de cada verificação de permissão — o efeito aparece em praticamente toda consulta do sistema, não só em perfis.

### 2. Regras de acesso avaliadas uma vez por consulta
Reescrever as regras de `profiles` (e as equivalentes em `demands`, `board_members`, `team_members`) para resolver a identidade do usuário uma única vez por consulta, em vez de por linha. Mesmo resultado de visibilidade, muito menos trabalho repetido.

### 3. Fechar as funções internas para visitantes
Remover a permissão de execução por visitantes não logados das funções que não fazem parte de nenhum fluxo público (gatilhos, manutenção, mutações internas). As poucas que links públicos realmente usam — resumo compartilhado, nota compartilhada, entrar em quadro por convite, checagem de código de equipe — continuam abertas.

### 4. Abertura de demandas com anexos mais rápida
Hoje cada anexo pede um link assinado separado ao abrir a demanda. Passa a pedir todos de uma vez, com reaproveitamento do link enquanto ele é válido. Some a espera de ~1,2 s por arquivo em demandas com vários anexos.

### 5. Proteger o banco quando o cache externo oscilar
A leitura com cache hoje espera o cache externo responder antes de decidir; se ele ficar lento, todos os pedidos caem no banco ao mesmo tempo. Vai passar a ter corte de espera mais curto e uma pausa automática maior quando ele falha em sequência, evitando pico simultâneo de conexões (o limite atual é 60 e já se opera perto de 30).

### 6. Medir antes e depois
Registrar o tempo das consultas de perfis e de demandas antes e depois das mudanças, e reportar o ganho real.

## Fora do escopo

- Rollbacks do Postgres: o número é acumulado desde a última reinicialização e não indica falha por si só. Vou observar o crescimento, não mexer em nada agora.
- Reescrever a listagem de demandas: o cache versionado já resolve o caso comum; mexer nos relacionamentos agora traria risco sem ganho claro.

## Detalhes técnicos

Migração:
- `CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);` e `CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);`
- Recriar as policies de `profiles` (`Team members can view teammate profiles`), e as análogas em `demands`/`board_members`/`team_members`, trocando `auth.uid()` por `(select auth.uid())` — mantendo `qual` e `roles` idênticos no resto.
- `REVOKE EXECUTE ... FROM anon` nas funções `SECURITY DEFINER` sem uso público: `trg_bump_demands_version`, `trg_seed_service_catalog_on_team`, `revoke_access_on_team_member_removed`, `bump_board_demands_version`, `purge_old_read_notifications`, `convert_subdemand_to_request`, `board_demand_facts`, `get_board_metrics`, `search_index_status`, `match_board_documents`, `has_role`, `get_user_team_ids`, `get_user_board_ids`, `is_team_member`, `get_user_id_by_email`. Mantidas para `anon`: `check_access_code_exists`, `email_exists`, `password_reset_required`, `get_team_by_access_code`, `get_shared_board_summary`, `verify_note_share_token`, `is_note_shared*`, `is_demand_shared`, `join_board_via_share_token`.
- Revalidar as rotas públicas (`/shared/...`, convite de quadro, cadastro) após o revoke.

Aplicação:
- `useAttachments`: substituir N chamadas `createSignedUrl` por uma `createSignedUrls(paths, ttl)`, com cache em memória por caminho até 80% do TTL.
- `src/lib/cachedFetch.ts`: `CACHE_TIMEOUT_MS` de 1200 → 600, `FAILURE_THRESHOLD` 3 → 2, `DISABLE_WINDOW_MS` 60s → 120s.

Validação:
- `EXPLAIN (ANALYZE, BUFFERS)` em `profiles` e `demands` como usuário autenticado, antes/depois.
- `pg_stat_user_tables`: confirmar queda das varreduras completas em `team_members`.
- Playwright: abrir demanda com anexos, quadro público compartilhado e fluxo de entrar em equipe.
