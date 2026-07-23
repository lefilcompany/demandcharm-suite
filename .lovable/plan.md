## Problema

O upload de anexos em solicitações de demanda falha com `new row violates row-level security policy` porque a policy de INSERT no bucket `demand-attachments` exige que o **primeiro segmento do path seja o `auth.uid()` do usuário**:

```
((auth.uid())::text = (storage.foldername(name))[1])
```

Todos os outros uploaders do sistema (`useAttachments`, `imageUploadUtils`, MCP) seguem essa convenção: `${user.id}/...`. Já o `useUploadRequestAttachment` usa `request-${requestId}/uuid.ext` ou `comment-${commentId}/uuid.ext`, sem o prefixo do usuário — por isso o RLS bloqueia.

## Correção

Ajustar o path no `src/hooks/useRequestAttachments.ts` para seguir a mesma convenção do restante do sistema, mantendo o agrupamento por request/comentário:

- Antes: `request-${requestId}/${uuid}.${ext}` / `comment-${commentId}/${uuid}.${ext}`
- Depois: `${user.id}/request-${requestId}/${uuid}.${ext}` / `${user.id}/comment-${commentId}/${uuid}.${ext}`

Isso resolve o erro sem precisar alterar policies (a policy atual já é a correta e segura — cada usuário só grava na sua própria pasta).

## Fora de escopo

- Não mexer nas policies de storage — a regra vigente é a padrão do projeto e alinhada com todos os outros uploads.
- Não migrar anexos antigos de solicitações já criadas (se houver algum órfão, continuará acessível via `file_path` gravado no banco).
- Nenhuma mudança em RLS de `demand_request_attachments` (a tabela já cobre o solicitante corretamente).

## Verificação

- Enviar solicitação com múltiplos anexos na principal e em subdemandas via `CreateRequestQuickDialog` como usuário solicitante e confirmar que todos os anexos ficam vinculados sem erro no console.
