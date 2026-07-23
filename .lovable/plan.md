
# Subdemandas na Solicitação de Demanda

Estender o modal `CreateRequestQuickDialog` (usado pelos solicitantes) com a mesma lógica de subdemandas já existente na criação de demandas (fluxo em etapas + travamento por dependência), persistir o "plano" de subdemandas junto à solicitação e materializá-las como subdemandas reais quando o admin/coord aprovar.

## O que passa a existir

- Botão `+/-` "Subdemandas" no formulário principal da solicitação (0 a 20), idêntico ao já usado em Nova Demanda.
- Quando o contador for `> 0`, o modal vira wizard com etapas:
  ```text
  [Principal] — [Sub 1] — [Sub 2] — ... — [Revisão]
  ```
  - Barra de progresso reutilizando `StepProgress` (com "Voltar", pular para etapa já visitada, marcação de etapa salva).
  - Botões "Voltar" / "Próximo" / "Enviar solicitação" no rodapé, substituindo o botão único atual.
- Cada subdemanda pede: título, descrição, prioridade, serviço, data de entrega, anexos e "Pode iniciar quando [Sub X] for concluída" (travamento por dependência). Não pede status nem responsáveis — coerente com o que hoje o solicitante já não escolhe na demanda principal (isso continua sendo do aprovador).
- Etapa "Revisão" lista a demanda principal e todas as subdemandas com edição por clique nas pílulas de etapa.
- Rascunho (`useFormDraft`) passa a persistir também o array de subdemandas e a etapa atual, para o solicitante não perder o preenchimento.

## Aprovação: materializar subdemandas

Quando o admin/coord aprovar a solicitação (`useApproveDemandRequest`), além de criar a demanda principal como já faz hoje, o sistema:

1. Cria cada subdemanda em `demands` com `parent_demand_id = demanda_principal.id`, herdando `team_id`, `board_id`, `created_by`, `status_id` padrão do quadro e usando `title/description/priority/service_id/due_date` do plano.
2. Copia os anexos daquela subdemanda (armazenados no bucket da solicitação) para `demand_attachments` da subdemanda recém-criada, mesmo padrão já usado para a principal.
3. Cria as dependências (`demand_dependencies`) traduzindo `dependsOnIndex` do plano para os IDs das subdemandas recém-criadas — habilitando o "travamento" (a sub só pode sair de "A Iniciar" depois da anterior concluir), reutilizando a lógica já existente em `subdemandStatusPropagation`.
4. Responsáveis das subdemandas ficam a cargo do aprovador via UI existente após aprovação (mesma regra atual: solicitante não escolhe responsável).

## Detalhes técnicos

- **Backend (Lovable Cloud)** — 1 migration:
  - `demand_requests`: `ADD COLUMN subdemands_plan JSONB NOT NULL DEFAULT '[]'::jsonb` (array de objetos `{ tempId, title, description, priority, service_id, due_date, dependsOnIndex }`).
  - `demand_request_attachments`: `ADD COLUMN subdemand_index INTEGER` (NULL = anexo da principal, 0..N = índice da subdemanda no `subdemands_plan`). Sem mudança de policies — RLS já cobre por `demand_request_id`.
- **Frontend**:
  - Novo `src/components/request-wizard/RequestSubdemandStepForm.tsx` derivado de `SubdemandStepForm`, sem seletores de status e responsáveis (não aplicáveis ao solicitante).
  - `CreateRequestQuickDialog.tsx` reescrito para máquina de estados de etapas (`currentStep`, `maxVisitedStep`, `savedSteps`) reaproveitando `StepProgress`, `SubdemandCountStep`, `ReviewStep` e o novo form de sub.
  - `useCreateDemandRequest` recebe `subdemands_plan` e persiste no insert.
  - `useUploadRequestAttachment` ganha parâmetro opcional `subdemandIndex` para gravar a coluna nova.
  - `useApproveDemandRequest` lê `subdemands_plan` da request após criar a principal, insere subdemandas em lote, copia anexos filtrando por `subdemand_index` e cria `demand_dependencies` conforme `dependsOnIndex`.
- **Validação de envio** (mesma linha do atual `logBlockedSubmit`): título obrigatório + serviço + `due_date` por subdemanda; dependência precisa apontar para índice menor.
- **Nada muda** para admin/coord/executor no fluxo já existente de Nova Demanda.

## Fora de escopo

- Alterar quem pode aprovar, políticas RLS existentes ou o restante do `DemandRequests.tsx` além do hook de aprovação.
- Suporte a responsáveis/status escolhidos pelo solicitante (continua indisponível, como hoje).
