# Fase 4 — Fechamento mensal

Nova aba **Fechamento** na Inteligência Financeira (em `/app/finance` e `/admin/finance`) para conferir, simular e fechar um mês de cada equipe, guardando uma fotografia imutável dos números.

## O que o usuário verá

1. **Seletor de mês** com o status de cada competência: Aberto, Fechado, Reaberto com ajustes.
2. **Checklist de conferência** (cada item com contagem, explicação e atalho para corrigir):
   - Apontamentos de tempo ainda em andamento no mês
   - Despesas sem categoria ou sem tipo (direta/compartilhada)
   - Receitas sem mês de competência
   - Colaboradores com horas no mês e sem custo/hora válido
   - Rateios incompletos (despesa compartilhada sem base para dividir)
   - Valores não distribuídos
   - Diferença entre a soma dos quadros e o total da equipe
   Itens são classificados em **Bloqueia** (impede fechar) ou **Aviso** (pode fechar ciente).
3. **Simular fechamento**: mostra o resultado e a margem por quadro como ficariam, sem gravar nada.
4. **Confirmar fechamento** (com digitação do mês para confirmar): grava a fotografia do mês.
5. **Mês fechado**: telas passam a ler os números guardados, com selo "Fechado em dd/mm por Fulano". Lançamentos daquele mês ficam travados para edição comum.
6. **Ajustes auditáveis**: para corrigir um mês fechado, cria-se um ajuste (valor, quadro, motivo obrigatório). O resultado mostra "Fechado + ajustes", sem apagar o original.
7. **Histórico**: linha do tempo de fechamentos e ajustes; exportação CSV para quem tem permissão de exportar.

Assinatura visual: régua de conferência no padrão "sala de operações" (grafite, Barlow Condensed, JetBrains Mono) — cada item como uma marca na régua, verde/âmbar/vermelho via tokens.

## Permissões
- Nova capacidade **fechar mês** concedida explicitamente (mesmo modelo das concessões atuais, sem self-grant, auditada). Ver o checklist exige leitura financeira; criar ajuste exige gestão de receitas/despesas; solicitantes sempre excluídos.
- Reabertura completa não existe: correção só via ajustes.

## Fora do escopo
- Fechamento automático agendado.
- Alteração de demandas entregues (continuam protegidas).

## Detalhes técnicos
- Migração aditiva:
  - `finance_periods` (team_id, competência, status, closed_at/by, versão das regras, totais).
  - `finance_period_snapshots` (period_id, board_id, receita, custos, rateios, impostos, resultado, margem, custo agregado da equipe — nunca por pessoa para quem não tem acesso a salários; JSON das premissas e métodos de rateio usados).
  - `finance_period_adjustments` (period_id, board_id, tipo, valor, motivo, autor) — somente inserção.
  - Novo valor de permissão `close_period` em `finance_permissions`.
  - Grants + RLS com `(select auth.uid())` e `has_finance_permission`.
- RPCs SECURITY DEFINER com checagem de permissão: `finance_close_checklist(team, mes)`, `finance_simulate_close(team, mes)` (reusa `get_finance_overview`/`_finance_allocations`), `finance_close_period(team, mes)` (rodando checklist no servidor, recusa se houver bloqueios), `finance_add_adjustment(...)`. Todas gravam em `finance_audit_log`.
- Trigger de travamento: INSERT/UPDATE/DELETE em `finance_revenues`, `finance_expenses`, `finance_employee_costs` de mês fechado é recusado (`PERIOD_CLOSED`).
- `get_finance_overview` passa a devolver snapshot + ajustes para meses fechados.
- Lógica pura em `src/lib/finance/closing.ts` (classificação do checklist, soma snapshot + ajustes) com testes: bloqueio impede fechar, ajuste soma sem alterar o original, mês fechado retorna valores da fotografia, diferença de centavos detectada.
- UI: `src/components/finance/MonthlyClosing.tsx` + hook em `useFinance.ts`; regra registrada no `AGENTS.md`.
- Verificação: fluxo logado simular → fechar → tentar editar despesa do mês (recusado) → ajuste → histórico; tentativa sem permissão recusada no banco.
