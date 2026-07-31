# Organizar projetos por quadro na tela /demands

Hoje os projetos (pastas) são vinculados apenas à equipe (`projects.team_id`) — não existe vínculo com quadro. Por isso a faixa de projetos em /demands mostra todos os projetos da equipe de uma vez.

## Objetivo

- Por padrão, a faixa mostra **somente os projetos do quadro atualmente selecionado**.
- Um botão "Ver todos os projetos" alterna para mostrar todos os projetos da equipe (não fica ativo por padrão).
- Projetos existentes/novos podem ser **movidos de quadro** a qualquer momento.

## Comportamento proposto

1. Faixa de projetos em /demands
   - Estado padrão: apenas projetos do quadro selecionado.
   - Botão de alternância ao lado de "Novo projeto": "Ver todos os projetos" / "Somente deste quadro". Quando ativo, cada card exibe o nome do quadro de origem.
   - Quando o usuário estiver com "Todos os quadros" ativo nos filtros, a faixa segue a mesma regra do botão (padrão continua sendo o quadro selecionado).
2. Criação de projeto
   - O projeto criado em /demands passa a nascer vinculado ao quadro selecionado.
   - Se nenhum quadro estiver selecionado, o projeto nasce "sem quadro" e aparece apenas no modo "todos".
3. Reallocação (sim, é possível)
   - Nova opção no menu do card do projeto: **"Mover para outro quadro"**, com um diálogo listando os quadros da equipe (mais a opção "Sem quadro").
   - Só o dono do projeto (ou compartilhado com permissão de edição) pode mover.
   - As demandas já vinculadas ao projeto não são alteradas — apenas o quadro onde o projeto aparece.

## Detalhes técnicos

Banco (migração):
- `ALTER TABLE public.projects ADD COLUMN board_id uuid NULL REFERENCES public.boards(id) ON DELETE SET NULL;` + índice em `(team_id, board_id)`.
- Backfill: para cada projeto sem `board_id`, atribuir o quadro mais frequente entre as demandas ligadas em `project_demands`; projetos sem demandas ficam `NULL` (visíveis apenas no modo "todos").
- Coluna é anulável, então as políticas RLS atuais de `projects` continuam válidas; nenhuma nova policy é necessária.

Frontend:
- `src/hooks/useDemandFolders.ts`: `useDemandFolders(teamId, userId, boardId?, { includeAll })` filtra por `board_id` quando não estiver no modo "todos"; `useCreateFolder` passa a aceitar `board_id`; novo `useMoveFolderToBoard`.
- `src/components/DemandFolderStrip.tsx`: recebe `boardId`, mantém o estado do toggle (persistido em `localStorage` por usuário), renderiza o botão de alternância, o badge do quadro no modo "todos" e o item de menu "Mover para outro quadro".
- Novo `src/components/MoveFolderToBoardDialog.tsx` usando os quadros de `useBoards`.
- `src/pages/Demands.tsx`: repassa `selectedBoardId` para a faixa.
- `src/pages/Projects.tsx` e `src/pages/FolderDetail.tsx`: exibir o quadro do projeto (somente leitura), sem mudar o comportamento de listagem dessas telas.
