
## Objetivo

Trazer para a `main` todos os ajustes que estavam na branch `agent/schedule-deadline-reminders`: agendar a Edge Function `check-deadlines` diariamente às 09:00 America/Recife via `pg_cron` + `pg_net` com token gerado no Vault, aceitar esse token (mantendo `CRON_SECRET` como fallback) tanto em `check-deadlines` quanto em `send-push-notification`, remover emojis dos títulos dos lembretes, marcar as duas funções com `verify_jwt = false`, adicionar testes e garantir a compilação Deno dos entrypoints na CI.

## Estado atual (verificado)

- `supabase/functions/check-deadlines/index.ts` já valida `CRON_SECRET` via `isAuthorized`, chama `send-push-notification` com o mesmo `Bearer ${cronSecret}` e usa o template React Email (`_templates/notification.tsx` já tipado, sem HTML cru).
- `supabase/functions/send-push-notification/index.ts` já aceita `Bearer ${CRON_SECRET}` como bypass do JWT do usuário.
- `supabase/functions/check-deadlines/lib.ts` (linhas 227–279) tem `"⏰ Demanda vence amanhã"` e `"🚨 Demanda com prazo vencido"` — emojis ainda presentes.
- `supabase/config.toml` só contém `project_id`. Não há bloco `[functions.*]` marcando `verify_jwt = false` para as duas funções.
- `.github/workflows/ci.yml` já roda `deno test` sobre `supabase/functions/check-deadlines/` (job `edge-functions`), mas **não** compila os entrypoints (`deno check` em `index.ts`). Selenium já está condicionado aos secrets do repositório.
- Não existe migration agendando `check-deadlines`.

## Mudanças

### 1. Remover emojis dos títulos (lib.ts)

Em `supabase/functions/check-deadlines/lib.ts`:
- `title: "⏰ Demanda vence amanhã"` → `title: "Demanda vence amanhã"`
- `title: "🚨 Demanda com prazo vencido"` → `title: "Demanda com prazo vencido"`

### 2. Autenticação dupla (CRON_SECRET + token do Vault)

Em `lib.ts`, transformar `isAuthorized` para aceitar múltiplos segredos:

```ts
export function isAuthorized(
  authHeader: string | null | undefined,
  ...secrets: Array<string | null | undefined>
): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  return secrets.some((s) => typeof s === "string" && s.length > 0 && s === token);
}
```

Atualizar `check-deadlines/index.ts`:
- Ler também `CRON_TOKEN` (novo, populado a partir do Vault pela migration/secret) via `Deno.env.get("CRON_TOKEN")`.
- Chamar `isAuthorized(header, cronSecret, cronToken)` — pelo menos um dos dois precisa estar definido; caso contrário 401.
- Encaminhar para `send-push-notification` o mesmo token que autenticou a requisição (preferir `cronToken` quando presente, senão `cronSecret`).

Atualizar `send-push-notification/index.ts`:
- Aceitar `Bearer ${CRON_SECRET}` **ou** `Bearer ${CRON_TOKEN}` como bypass do JWT do usuário. Usuários autenticados continuam passando pela validação atual via `auth.getUser`.

### 3. Testes Deno adicionais

- `check-deadlines/lib_test.ts`: adicionar casos garantindo que `isAuthorized` aceita CRON_SECRET, aceita CRON_TOKEN, aceita qualquer um dos dois, rejeita token vazio/ausente, e que `buildDayBeforeReminder`/`buildOverdueReminder` produzem títulos sem emoji (`"Demanda vence amanhã"`, `"Demanda com prazo vencido"`).
- Ajustar quaisquer asserts existentes que dependessem dos emojis.

### 4. `supabase/config.toml`

Adicionar blocos explícitos:

```toml
[functions.check-deadlines]
verify_jwt = false

[functions.send-push-notification]
verify_jwt = false
```

(Ambas fazem autenticação própria — via CRON_SECRET/CRON_TOKEN ou JWT do usuário lido em código.)

### 5. Migration `pg_cron` + `pg_net` + Vault

Criar `supabase/migrations/<timestamp>_schedule_deadline_reminders.sql`:

- `create extension if not exists pg_cron;`
- `create extension if not exists pg_net;`
- Gerar um token aleatório (`encode(gen_random_bytes(32), 'hex')`) e armazenar em `vault.secrets` sob o nome `check_deadlines_cron_token` (usando `vault.create_secret(...)` idempotente — se já existir, apenas reaproveita).
- Criar função `public.get_check_deadlines_cron_token()` `security definer` cujo `EXECUTE` é revogado de `public/anon/authenticated` e concedido apenas a `service_role`, retornando o `decrypted_secret` do Vault.
- Remover job anterior com o mesmo nome (`select cron.unschedule('check-deadlines-daily') where exists (...)`), então:
  ```sql
  select cron.schedule(
    'check-deadlines-daily',
    '0 12 * * *',
    $$
    select net.http_post(
      url := 'https://erxhxmetrvkigjwxchbj.supabase.co/functions/v1/check-deadlines',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_check_deadlines_cron_token()
      ),
      body := jsonb_build_object('scheduled_at', now())
    );
    $$
  );
  ```
- O mesmo token gerado será também salvo como secret `CRON_TOKEN` na Edge Function (via `secrets--set_secret`) após a migration ser aprovada, para que `check-deadlines` e `send-push-notification` possam validá-lo. O `CRON_SECRET` existente permanece intocado como fallback.

### 6. CI: compilar entrypoints das Edge Functions

Em `.github/workflows/ci.yml`, dentro do job `edge-functions`, adicionar um step antes do `deno test`:

```yaml
- name: Compile edge function entrypoints
  run: |
    deno check supabase/functions/check-deadlines/index.ts
    deno check supabase/functions/send-push-notification/index.ts
```

Isso captura falhas de tipagem/import que os testes atuais não pegavam.

## Passos técnicos (ordem)

1. `supabase--migration` com o SQL descrito no item 5 (aguarda aprovação do usuário).
2. Após aprovação, `set_secret` do `CRON_TOKEN` com o valor lido de `select public.get_check_deadlines_cron_token()`.
3. Editar `lib.ts` (emojis + `isAuthorized` variádico).
4. Editar `check-deadlines/index.ts` (ler `CRON_TOKEN`, passar adiante).
5. Editar `send-push-notification/index.ts` (aceitar `CRON_TOKEN`).
6. Editar `supabase/config.toml` (dois blocos `verify_jwt = false`).
7. Editar `check-deadlines/lib_test.ts` com os novos casos + títulos sem emoji.
8. Editar `.github/workflows/ci.yml` com o step `deno check`.
9. `supabase--test_edge_functions` para rodar os testes Deno das duas funções.
10. `supabase--deploy_edge_functions` para `check-deadlines` e `send-push-notification`.
11. `supabase--read_query` em `cron.job` para confirmar `check-deadlines-daily` ativo com `0 12 * * *`.

## Riscos e observações

- O valor do secret `CRON_TOKEN` só é conhecido depois que a migration roda; por isso o passo 2 acontece após o 1. Enquanto `CRON_TOKEN` não estiver configurado, `check-deadlines` continua funcionando via `CRON_SECRET` (fallback preservado).
- A migration usa `vault.create_secret` de forma idempotente; se o Vault já contiver `check_deadlines_cron_token`, o job reutiliza sem regenerar (evita quebrar chamadas em voo).
- Nenhuma mudança em RLS de tabelas de negócio, nenhuma alteração no fluxo de deduplicação (`notification_deliveries`).
- Selenium continua condicional aos secrets — não é reintroduzido nem mascarado.
