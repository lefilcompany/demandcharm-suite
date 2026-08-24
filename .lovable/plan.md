# Corrigir etapa "Ajuste" que deveria ser "Em Ajuste"

## Diagnóstico (confirmado no banco)

Três quadros têm uma etapa gravada com o nome **"Ajuste"** (vermelho `#EF4444`) em vez de **"Em Ajuste"** (roxo `#9333EA`):

- LeFil Company → **CLIENTE: Morada da Paz** (posição 3)
- LeFil Company → **LEFIL: ESCOLA MDF** (posição 3)
- Teste → **Quadro Teste** (posição 8, etapa inativa)

Nenhuma demanda está atualmente nessa etapa nos três quadros (contagem zero), então o ajuste é seguro.

Causa: esses quadros foram criados por uma versão antiga da rotina de criação de quadro, que gerava a etapa como "Ajuste". A rotina atual já cria corretamente "Em Ajuste" — por isso o problema só afeta quadros antigos.

Consequência do nome errado: toda a lógica de ajuste e de **contagem de tempo** compara pelo nome exato "Em Ajuste" (acúmulo de tempo em progresso, timer automático, propagação para subdemandas, painel de insights, notificação de "Ajuste concluído"). Com o nome "Ajuste", a etapa não dispara nada disso.

## Correção

1. **Migração de dados**: renomear para "Em Ajuste" e padronizar a cor roxa (`#9333EA`) todas as etapas de quadro cujo nome seja "Ajuste" (comparação sem diferenciar maiúsculas/acentos), pulando qualquer quadro que já tenha uma etapa "Em Ajuste" para não criar duplicidade.
2. **Blindagem no aplicativo**: onde hoje o código compara o nome exatamente com "Em Ajuste", passar a reconhecer também variações legadas ("Ajuste"), para que qualquer quadro remanescente ou importado passe a contar tempo e disparar o fluxo de ajuste corretamente.
3. **Verificação final**: reconsultar o banco para confirmar que não sobrou nenhuma etapa "Ajuste" e conferir no quadro CLIENTE: Morada da Paz que a coluna aparece como "Em Ajuste" com a cor correta.

## Detalhes técnicos

- Migração: `UPDATE public.demand_statuses SET name = 'Em Ajuste', color = '#9333EA' WHERE board_id IS NOT NULL AND lower(trim(name)) = 'ajuste' AND NOT EXISTS (…'em ajuste' no mesmo board_id)`. Sem alteração de `position`, `is_active` ou `adjustment_type` (permanecem `none`, como nos demais quadros).
- Normalização de nome no frontend: helper único (em `src/hooks/useBoardStatuses.ts`) do tipo `isAdjustmentStage(name)` reutilizado em `src/pages/DemandDetail.tsx` (busca do `adjustmentStatusId` e lista `timerStatuses`), `src/hooks/useAdjustmentCount.ts`, `src/lib/subdemandStatusPropagation.ts` e `src/components/KanbanBoard.tsx` (interceptação do drag para a coluna de ajuste e conjuntos de status ativos).
- Funções de banco que dependem do nome (`update_time_in_progress`, `notify_adjustment_completed`, `notify_demand_status_changed`) não precisam mudar após a renomeação; se preferir robustez extra, elas podem passar a comparar `lower(name) IN ('em ajuste','ajuste')` na mesma migração.
- Nada é alterado nas demandas existentes nem no histórico de tempo.
