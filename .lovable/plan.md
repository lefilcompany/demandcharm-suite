## Objetivo
No modal de visualização de solicitação em `/demand-requests`, quando a solicitação tiver subdemandas planejadas (`subdemands_plan`), separar visualmente a demanda principal e cada subdemanda, cada uma com seus próprios anexos.

## Contexto atual
- `src/pages/DemandRequests.tsx` (linhas 1510-1520) mostra um único bloco `RequestAttachmentUploader` com todos os anexos da solicitação, sem distinguir os que pertencem à demanda principal dos que pertencem às subdemandas.
- No banco, `demand_request_attachments` já possui a coluna `subdemand_index`: os anexos da demanda principal têm `subdemand_index = null` e os das subdemandas têm o índice correspondente (0-based) — a lógica de upload já grava isso corretamente (`src/hooks/useRequestAttachments.ts` linha 89).
- `subdemands_plan` é um array JSONB salvo em `demand_requests` com `{ title, description, priority, service_id, ... }` por item.

## Mudanças (apenas frontend, no modal de visualização)

### 1. `src/components/RequestAttachmentUploader.tsx`
- Aceitar prop opcional `subdemandIndex?: number | null` (default `null` = principal).
- Filtrar `attachments` pelo `subdemand_index` correspondente antes de renderizar (principal = `subdemand_index == null`).
- Repassar `subdemandIndex` ao `uploadAttachment.mutateAsync` (já suportado pelo hook).
- Título do bloco continua "Anexos (N)" refletindo o total filtrado.

### 2. `src/pages/DemandRequests.tsx` — modal `viewing`
Reorganizar a área entre linhas ~1465-1520 em seções:

- **Demanda principal** (accordion/card aberto por padrão)
  - Prioridade, Serviço, Descrição (já existentes)
  - `RequestAttachmentUploader requestId={viewing.id}` (sem prop, = principal)

- **Subdemandas** (se `Array.isArray(viewing.subdemands_plan) && length > 0`)
  - Renderizar um `Accordion` (shadcn) com um item por subdemanda:
    - Trigger: `#{i+1} — {title}` + badge de prioridade + badge de serviço (nome + horas via lookup em `services` já carregados no board, ou usar `service_id` bruto se indisponível).
    - Conteúdo: descrição (RichTextDisplay) + `RequestAttachmentUploader requestId={viewing.id} subdemandIndex={i}`.
  - Cabeçalho da seção: ícone `Layers` + "Subdemandas (N)".

- Comentários permanecem inalterados abaixo (são da solicitação inteira).

### 3. Serviços das subdemandas
Para exibir nome/horas do serviço da subdemanda, reutilizar o hook `useBoardServices(viewing.board_id)` já usado no arquivo (verificar; caso não esteja carregado ali, importar e resolver por `service_id`).

## Fora do escopo
- Não alterar RLS, storage, migrations ou o hook de upload.
- Não mexer no card da lista (o "empilhamento estilo iOS" já existe).
- Comentários da solicitação continuam globais (não por subdemanda).
