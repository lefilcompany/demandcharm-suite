## Situação atual (verificada no banco)

A conta `vinicius.souza.ext@lefil.com.br` está em **11 equipes** (papel `executor` em todas): a, Criative Cloud, DemocraciaOS, Detalhes De Marketing, EAR DEMANDAS, Equipe Teste 2, Ferreira Costa, **LeFil Company**, LIMA TESTES, Maryana Equipe, Teste.

Também é membro de quadros fora da LeFil Company:
- a (1), EAR DEMANDAS (1), Equipe de Marketing (2), Equipe Teste 2 (2), Ferreira Costa (1), LIMA TESTES (1), Teste (1) — 9 vínculos de quadro
- LeFil Company: 36 quadros (mantidos)

Atribuições em demandas (`demand_assignees`): 138, **todas na LeFil Company** — nenhuma será afetada.

## Correção

1. Remover os vínculos de quadro (`board_members`) da conta em todos os quadros que não pertencem à LeFil Company — inclusive o quadro da "Equipe de Marketing", onde ele é membro de quadro sem ser membro da equipe.
2. Remover os vínculos de equipe (`team_members`) de todas as equipes exceto LeFil Company (10 remoções).
3. Manter intacto: a associação à LeFil Company, os 36 quadros dela e as 138 atribuições de demanda.
4. Conferir com nova consulta que restam exatamente 1 equipe e apenas quadros da LeFil Company.

## Detalhes técnicos

Executado com o tool de dados (DELETE), na ordem quadros → equipes, filtrando por `user_id` da conta e `team_id <> '35e8b17c-3550-4e01-a2d3-96bb558a7659'`. Nenhuma mudança de schema ou de código é necessária. Após a remoção, o usuário pode precisar recarregar a página, pois a equipe selecionada fica em cache local.