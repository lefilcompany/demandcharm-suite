# Detecção de publicação real em produção

## Mecanismos avaliados

1. **Hook/evento pós-deploy oficial do Lovable** — não existe hoje. O Lovable não
   expõe webhook, callback ou evento documentado de "deploy concluído".
2. **Workflow de deployment oficial** — o deploy do Lovable não é executado por
   um pipeline nosso (o GitHub Actions do repositório só roda CI: lint,
   typecheck, testes). Um job de CI termina no *push*, não na publicação, então
   ele **não** pode ser usado como sinal de release.
3. **Callback confiável após deploy** — não disponível.

Conclusão: não há hook pós-publicação oficial. Foi implementada a alternativa
mais confiável tecnicamente disponível: **observar o artefato realmente servido
pelo domínio de produção**.

## Mecanismo implementado (build fingerprint probe)

```
build do Lovable → assets publicados no domínio de produção
        ↓
GET https://pla.soma.lefil.com.br/build-info.json  (cron a cada 10 min)
        ↓ buildId diferente de qualquer release_key já ingerida
POST /functions/v1/ingest-release-event  (X-Release-Secret)
        ↓
platform_events (outbox) → process-platform-events → deliveries
```

- **`/build-info.json`**: gerado pelo plugin `releaseBuildInfoPlugin` em
  `vite.config.ts`. Contém `buildId` (SHA-256 dos nomes dos assets
  content-hashed → determinístico e único por versão), `builtAt`, `commitSha` e
  `deploymentId` (quando as variáveis de ambiente existirem no build).
- **`/release-manifest.json`**: cópia exata do `release-manifest.json` validado,
  publicada junto do build. É esse arquivo que é enviado ao ingest.
- **`detect-production-release`** (Edge Function, cron `*/10 * * * *`): lê os dois
  arquivos **no domínio de produção**, valida o manifest com o mesmo validador
  compartilhado, checa idempotência em `platform_releases.release_key` e chama
  `ingest-release-event`.

Por que isso não confunde commit/push com publicação: enquanto a nova versão não
estiver no ar, o domínio continua servindo o build antigo — o `buildId` só muda
quando os assets novos estão de fato acessíveis em produção.

`releaseKey = build-<buildId>` (determinístico por deploy). Se `deploymentId`
estiver disponível no ambiente de build, ele é enviado junto; `commitSha` idem.

## Segurança

- `RELEASE_EVENT_SECRET` fica apenas nos secrets do backend, usado server-side
  pela Edge Function. Nunca chega ao frontend.
- O cron autentica com um token guardado no Vault
  (`release_detection_cron_token`), lido por
  `public.get_release_detection_cron_token()` (apenas `service_role`).
- Admins globais podem disparar manualmente a detecção com o próprio JWT.

## Resiliência

- Falha ao ingerir **não** invalida a publicação: o erro é registrado em
  `public.release_detection_log` (visível só para admin global) e o próximo ciclo
  do cron tenta novamente, pois a release ainda não existe em `platform_releases`.
- O envio de e-mail/push é assíncrono via outbox. Resend fora do ar não afeta a
  detecção nem a publicação; os deliveries ficam em retry.

## Se um hook oficial passar a existir

Basta chamar o endpoint abaixo a partir do evento externo — nada mais precisa
mudar:

```
POST https://<projeto>.supabase.co/functions/v1/ingest-release-event
Headers:
  Content-Type: application/json
  X-Release-Secret: <RELEASE_EVENT_SECRET>
Body:
{
  "eventType": "deployment.published",
  "releaseKey": "<deploymentId ou commitSha+timestamp>",
  "deploymentId": "opcional",
  "commitSha": "opcional",
  "publishedAt": "2026-08-18T12:00:00.000Z",
  "manifest": { ...conteúdo de release-manifest.json... }
}
```
