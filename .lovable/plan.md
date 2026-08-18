# Camada de dados para anúncio automático de novidades (event-driven)

Somente banco de dados nesta etapa. Nenhuma Edge Function, nenhuma tela, nenhum processamento.

## Reuso do que já existe

- Permissão de administrador global: função `has_role(auth.uid(), 'admin')` sobre `user_roles` — nenhum sistema novo de permissão.
- Notificações internas: a tabela `notifications` atual será a saída do canal in-app quando o processamento for implementado; nada é duplicado agora.
- E-mail: as funções de e-mail existentes continuarão sendo o transporte; as novas tabelas apenas registram o que deve ser enviado e o que já foi enviado.

## Tabelas criadas

1. `platform_releases` — um registro por publicação detectada (chave única `release_key`, mais `deployment_id`, `commit_sha`, `source`, `status`, datas).
2. `release_features` — as novidades de cada release, com `announcement_key` único global (garante que a mesma novidade nunca é anunciada de novo em publicações seguintes), textos do anúncio, CTA, prioridade, público-alvo (global/equipe/quadro), listas de papéis, e ativação por canal.
3. `platform_events` — fila de eventos genérica com tentativas, próximo retry e erro, para o processamento assíncrono futuro.
4. `release_deliveries` — uma linha por usuário/canal, com `UNIQUE (announcement_key, user_id, channel)` garantindo idempotência: cada pessoa recebe cada novidade no máximo uma vez por canal.

Cada campo de status usa restrição de valores permitidos exatamente como especificado, e `updated_at` é mantido por gatilho onde a coluna existe.

## Segurança

- `platform_releases` e `release_features`: leitura apenas para administradores globais; nenhuma escrita pelo app.
- `platform_events` e `release_deliveries`: sem acesso pelo app; apenas o service role (Edge Functions futuras) manipula.
- RLS ativa em todas, com GRANTs coerentes (leitura para `authenticated` só onde há política de leitura admin; `service_role` com acesso total).

## Detalhes técnicos

- Uma migration única cria os quatro `CREATE TABLE`, seguidos de `GRANT`, `ENABLE ROW LEVEL SECURITY` e políticas, nessa ordem.
- Validação de valores por `CHECK` em `status`, `priority`, `audience_scope` e `channel` (valores fixos, não dependem de tempo).
- FKs: `release_features.release_id -> platform_releases(id) ON DELETE CASCADE`; `release_deliveries.release_feature_id -> release_features(id) ON DELETE CASCADE`. `user_id` fica sem FK para `auth.users`, seguindo o padrão do projeto.
- Índices: `platform_events(status, next_retry_at)`, `platform_events(event_type)`, `platform_events(aggregate_id)`; além de índices de apoio em `release_features(release_id)`, `release_features(status)`, `release_deliveries(release_feature_id)`, `release_deliveries(status, next_retry_at)` e `release_deliveries(user_id)`.
- Gatilhos `handle_updated_at` em `platform_releases` e `release_deliveries`.
- Após a migration: regenerar os tipos do backend usados pelo projeto e rodar o typecheck.
- Ao final, listo exatamente os arquivos criados/alterados.
