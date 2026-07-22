## Problema

Ao subir foto de perfil, o toast mostra "Erro no upload — Você não tem permissão para realizar esta ação". Esse texto é o mapeamento genérico de erros de RLS/Storage.

## Diagnóstico

Bucket `avatars` está público, mas as policies em `storage.objects` para ele estão assim (todas com role `public`):

- INSERT: `bucket_id='avatars' AND auth.uid()::text = storage.foldername(name)[1]`
- UPDATE: mesma condição
- DELETE: mesma condição
- **SELECT: nenhuma**

Duas causas prováveis, que vamos cobrir juntas:

1. **Falta policy de SELECT em `avatars`.** Uma migração de segurança anterior removeu a policy "Public bucket viewable by everyone". Sem SELECT, o `upload(..., { upsert: true })` — que envia `x-upsert: true` e faz `INSERT ... ON CONFLICT DO UPDATE` — falha em `HEAD`/verificação de objeto existente e volta como "not authorized". Também impede `createSignedUrl` e qualquer leitura autenticada da imagem.
2. **Policies com role `public` em vez de `authenticated`.** Funcionam quando o JWT chega, mas ficam frágeis se o header `Authorization` cair (ex.: quando o service worker antigo intercepta). Vale normalizar para `authenticated` (INSERT/UPDATE/DELETE) e `public` (SELECT — leitura pública porque o bucket é público).

## O que a migração vai fazer

Numa única migração em `storage.objects`:

1. `DROP POLICY` das três policies atuais de `avatars` (INSERT/UPDATE/DELETE com role `public`).
2. Recriar as três com role `authenticated` e a mesma condição `auth.uid()::text = storage.foldername(name)[1]`.
3. Criar `SELECT` público para o bucket `avatars` (`USING (bucket_id = 'avatars')`), já que o bucket é público e a foto precisa ser lida por qualquer visitante (sidebar, avatares em cards, etc.).

Sem mudanças no bucket em si (continua público) e sem tocar em `demand-attachments` ou `inline-images`.

## Verificação

Após aplicar, testar na UI em `/settings?tab=profile`:

1. Fazer upload de uma imagem — deve concluir sem erro e atualizar o avatar imediatamente na sidebar.
2. Recarregar e confirmar que a foto persiste (URL pública acessível).
3. Confirmar no console/network que o `POST /storage/v1/object/avatars/...` retorna 200 e que o `PATCH /rest/v1/profiles?id=eq...` grava o novo `avatar_url`.

Se o upload ainda falhar depois disso, é sinal de que o JWT não está sendo enviado pelo client — aí o próximo passo é inspecionar o request no DevTools e investigar interceptação por service worker / offlineStorage, sem mais mudanças em RLS.

Sem alterações de UI ou lógica de negócio; a mudança é somente nas policies de storage.
