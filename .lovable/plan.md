## Problema

O quadro **CLIENTE: COMUNIDADE - Magalu** (`9fb1cdaf-b0ca-4271-80ae-1e12304c9007`) está usando 6 status "globais" antigos (registros em `demand_statuses` com `board_id = NULL`), enquanto o resto do sistema já migrou para status escopados por quadro (com `board_id` preenchido). O frontend filtra os status pelo `board_id` do quadro atual — como esses status não têm `board_id`, o Kanban não encontra nenhuma coluna válida e todas as demandas do quadro (inclusive a #284 "Novas regras de pontuação da mais engajada do mês") ficam invisíveis.

Confirmado no banco:
- Demanda 284 existe, `archived = false`, `status_id = A Iniciar (global)`.
- Todos os 6 status ligados a esse quadro via `board_statuses` têm `board_id = NULL`.
- Existem 281 demandas ativas no quadro, todas apontando para status globais.
- Uma demanda extra aponta para um status "Entregue" órfão (`3f9b29d9…`) que nem está em `board_statuses` deste quadro.

## Solução (uma migration)

1. Criar 6 novos `demand_statuses` com `board_id = 9fb1cdaf…`, replicando nome/cor/posição dos globais atuais:
   - A Iniciar, Fazendo, Em Ajuste, Aprovação Interna, Aprovação do Cliente, Entregue.
2. Atualizar `board_statuses` do quadro para apontar para os novos IDs (mantendo posição e `is_active`).
3. Atualizar `demands.status_id` de todas as demandas do quadro para o novo status equivalente (mapeamento por nome).
4. Mapear a demanda órfã com status `3f9b29d9…` para o novo "Entregue" do quadro.
5. Não excluir os status globais antigos — outros quadros legados podem depender deles; apenas desvincular deste quadro.

Após a migration, a demanda 284 e as demais reaparecem no Kanban com seus status corretos, sem alteração de dados de negócio (título, atribuições, prazos, histórico permanecem intactos).

## Verificação

Após aplicar:
- `SELECT count(*) FROM demands WHERE board_id = '9fb1cdaf…' AND archived = false` continua 281.
- Todos os `status_id` das demandas do quadro passam a existir em `demand_statuses` com o `board_id` do quadro.
- A demanda 284 aparece na coluna "A Iniciar".
