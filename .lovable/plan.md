## Diagnóstico (confirmado no banco)

Demanda **#0060 — "Envio de Ronda Diária"** (quadro CLIENTE: Morada da Paz):
- Criada em 28/07/2026 18:09, status **Entregue**, vinculada à recorrência `Envio de Ronda Diária` (diária, sem data fim, ativa).
- A recorrência está com `next_run_date = 2026-07-28` (data já passada) e `last_generated_at = vazio` — ou seja, **nunca foi executada pelo processo automático**. A demanda #0060 é apenas a primeira, criada junto com o cadastro da recorrência.

Causa raiz:
- No banco existe **apenas 1 agendamento** ativo (`check-deadlines-daily`). **Não existe nenhum agendamento chamando a função `process-recurring-demands`.**
- Reflexo disso: a última leva de demandas geradas automaticamente (padrão 06:00 UTC, várias recorrências no mesmo minuto) foi em **26/05/2026**. Depois disso, toda demanda com `recurring_demand_id` foi criada no exato momento em que o usuário cadastrou a recorrência — nenhuma repetição automática.

Ou seja: não é bug de "entregar a demanda faz sumir". O motor de recorrência simplesmente parou de rodar em 26/05 e nenhuma recorrência do sistema (todos os quadros, não só Morada da Paz) está gerando demandas novas.

## Correção proposta

1. **Recriar o agendamento diário** de `process-recurring-demands` via `cron.schedule`, chamando a função com o header `Authorization: Bearer <CRON_SECRET>` que ela já valida, no mesmo padrão do `check-deadlines-daily` (execução ~06:00 UTC).
2. **Guardar o segredo em função no banco** (mesmo padrão de `get_check_deadlines_cron_token`) para não expor o token no comando do cron, ou reutilizar mecanismo equivalente.
3. **Execução de recuperação**: rodar a função uma vez manualmente após o agendamento, para gerar as demandas pendentes de hoje (as recorrências com `next_run_date` vencido geram 1 demanda e avançam a data — sem duplicar histórico).
4. **Verificação**: conferir nos logs da função e no banco que `last_generated_at` e `next_run_date` foram atualizados, e que a "Envio de Ronda Diária" da Morada da Paz recebeu a nova demanda do dia.

## Detalhes técnicos

- A função `supabase/functions/process-recurring-demands/index.ts` já está correta: valida `CRON_SECRET`, ignora recorrências já geradas no dia (`last_generated_at`), avança `next_run_date` em loop até ultrapassar hoje e desativa quando passa de `end_date`. Nenhuma alteração de lógica é necessária.
- O agendamento será criado com o tool de inserção de dados (contém URL/segredo específicos do projeto), não com migração versionada.
- Nada será alterado na demanda #0060; ela permanece entregue como está.
