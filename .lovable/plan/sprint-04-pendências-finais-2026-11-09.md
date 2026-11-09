# Sprint 04 — pendências finais

## 1. Ajustes pós-fechamento no projeto
- Ajustes continuam lançados por quadro (nada muda para quem já usa o Fechamento).
- O número consolidado do projeto em mês fechado passa a ser: fotografia do projeto + soma dos ajustes dos quadros ligados ao projeto naquele mês.
- O mesmo valor aparece na aba "Resultado" do projeto, em "Finanças → Por projeto" e na API externa, com selo "Fechado + ajustes" quando houver.
- Lista dos ajustes (quadro, valor, motivo, autor, data) visível dentro do projeto.

## 2. Homologação dos 3 cenários do guia
Montados com dados temporários no banco e apagados no final:
- Projeto com 1 quadro dedicado: horas, custo, faturamento e margem batem com a conta manual.
- Projeto com 2 quadros (ex.: Dev + Design): totais somados, despesas compartilhadas sem contagem dupla.
- Demanda sem projeto (ou quadro em 2 projetos): cai em "pendente" e só conta depois de "Atribuir aqui".
- Fechar o mês, lançar ajuste e conferir que todos os pontos acima mostram o mesmo número.

## 3. Checklist de Go-Live
- Conferência na tela com Playwright: aba do projeto, "Por projeto" e Fechamento com conta que tenha acesso.
- Lista no chat de quais projetos ainda estão com o controle financeiro desligado, para você decidir quais ligar (não ligo nenhum sem sua confirmação).

## Detalhes técnicos
- Migração: `_finance_project_month` (ramo de mês fechado) soma `finance_period_adjustments` por `board_id IN project_boards` válidos na competência; nova RPC `get_project_adjustments(project_id, competence)` com a mesma checagem de `has_finance_permission`.
- `projectRollup.ts`: aplicar ajustes reaproveitando `applyAdjustments` de `closing.ts`; testes unitários para mês fechado com e sem ajuste.
- Cenários validados via SQL em transação com ROLLBACK; atualizar AGENTS.md e roadmap.md.
