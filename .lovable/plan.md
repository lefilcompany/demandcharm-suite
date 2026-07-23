## Objetivo
No fluxo de criação de quadro, parar de adicionar automaticamente todos os donos (admins) da equipe como membros. Só o criador entra por padrão; qualquer outra pessoa deve ser adicionada explicitamente no wizard.

## Mudança

Nova migration atualizando `public.create_board_with_services(...)`:

- Remover o bloco `UNION ALL` que traz `team_members` com `role = 'admin'` e os insere como `moderator` no quadro.
- Manter:
  - Criador → `admin` do quadro.
  - Membros vindos de `p_members` (escolhidos no wizard) → com a role informada (default `executor`).
- `ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role` preservado, para que se o próprio criador aparecer em `p_members` ele continue como `admin` (prioridade pela `ROW_NUMBER` já garante isso).

Nenhuma alteração de frontend necessária — `CreateBoardWizard` já envia `p_members` com a lista escolhida.

## Detalhes técnicos

Trecho do CTE `base` passa de:

```sql
SELECT v_user_id, 'admin', 1
UNION ALL
SELECT tm.user_id, 'moderator', 2
FROM public.team_members tm
WHERE tm.team_id = p_team_id AND tm.role = 'admin' AND tm.user_id <> v_user_id
UNION ALL
SELECT (m->>'user_id')::uuid, COALESCE(..., 'executor')::team_role, 3
FROM jsonb_array_elements(COALESCE(p_members, '[]'::jsonb)) m
WHERE EXISTS (... team_members ...)
```

para:

```sql
SELECT v_user_id, 'admin', 1
UNION ALL
SELECT (m->>'user_id')::uuid, COALESCE(..., 'executor')::team_role, 2
FROM jsonb_array_elements(COALESCE(p_members, '[]'::jsonb)) m
WHERE EXISTS (... team_members ...)
```

Restante da função (validações, criação de stages, board_services, "Entregue" fallback) permanece igual.

## Impacto
- Quadros novos: só o criador é adicionado automaticamente; admins da equipe continuam podendo enxergar/gerenciar via políticas de RLS existentes (não dependem de estar em `board_members`).
- Quadros já existentes: não são afetados.
