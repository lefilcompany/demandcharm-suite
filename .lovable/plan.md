# Subdemanda vira solicitação + Backlog em todos os quadros

## 1. Desvincular subdemanda e enviar para Solicitações

Na tela da subdemanda (e no menu do cartão dentro da lista de subdemandas) entra a ação
"Enviar para Solicitações".

Fluxo:
- Abre uma confirmação explicando o que vai acontecer: a subdemanda sai do quadro e passa a
  aguardar aprovação na seção de Solicitações.
- Ao confirmar, é criada uma solicitação pendente no mesmo quadro, preservando título,
  descrição, prioridade e serviço.
- A subdemanda é retirada do quadro (vai para a lixeira, com os 30 dias de recuperação já
  existentes), mantendo o histórico caso alguém precise recuperá-la.
- A demanda-mãe é atualizada na hora: contadores, ordem das subdemandas e resumos refletem a
  saída.
- Bloqueios: não é permitido enviar uma subdemanda que tenha outras subdemandas dependendo
  dela; nesse caso aparece uma mensagem clara.

Permissão: qualquer membro do quadro pode fazer isso.

## 2. Backlog disponível em todos os quadros

- Todos os quadros existentes passam a ter a coluna "Backlog" como primeira etapa.
- Todo quadro novo já nasce com o Backlog na primeira posição.
- A coluna continua removível por quem gerencia o quadro, e demandas nela seguem podendo ficar
  sem data de entrega e fora do cálculo de atraso.

## Detalhes técnicos

Banco (migração):
- Nova função `convert_subdemand_to_request(p_demand_id uuid)` (SECURITY DEFINER): valida que o
  usuário é membro do quadro e que a demanda tem `parent_demand_id`, recusa se houver dependentes,
  insere em `demand_requests` (status `pending`, `created_by = auth.uid()`, board/team/serviço/
  prioridade herdados) e move a demanda para a lixeira (`archived = true`, `trash_expires_at`),
  limpando `parent_demand_id`. Retorna o id da solicitação. `GRANT EXECUTE ... TO authenticated`.
- Backfill: inserir `board_statuses` com o status "Backlog" (criando a linha em `demand_statuses`
  se necessário) para todo board que ainda não tenha, com `position` anterior à primeira etapa.
- Atualizar o seed de etapas de novos quadros (`create_board_with_services`) para incluir Backlog
  como primeira etapa.

Front-end:
- `src/hooks/useSubdemands.ts`: hook `useSendSubdemandToRequests` chamando a RPC, invalidando
  `subdemands`, `demands`, `demands-list`, `demand-requests`, `archived-demands` e
  `kanban-columns`.
- Novo `src/components/SendSubdemandToRequestsDialog.tsx` com a confirmação.
- Acionadores: `SubdemandEditForm.tsx` / tela da subdemanda em `DemandDetail.tsx` e menu do item
  em `KanbanSubdemandsList.tsx`.
- `KanbanStagesManager.tsx`: o bloco "Adicionar Backlog" deixa de ser o caminho padrão (o quadro
  já vem com ele) e segue disponível apenas quando a etapa foi removida.

Testes: caso Vitest para a regra de bloqueio por dependência e verificação de build.
