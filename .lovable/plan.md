# Kanban mais limpo: ocultar entregues antigas e "Limpar quadro"

## O que o usuário vai ver
- **Ocultação automática:** no Kanban do quadro, demandas entregues há mais de 31 dias deixam de aparecer na coluna de entregues. Nada é apagado: continuam na página **Demandas** (lista/tabela), nos relatórios, na busca e no link direto.
- **Botão "Limpar quadro"** no topo do Kanban (ao lado de "Baixar resumo"), para administradores e coordenadores do quadro.
  - Abre um aviso antes de confirmar:
    - Quantas demandas entregues vão sair do Kanban agora.
    - Elas continuam na página Demandas, relatórios e busca; nada é excluído.
    - **As demandas ainda abertas não serão limpas** e continuam no Kanban.
    - A limpeza vale para todos os membros do quadro.
    - Demandas entregues depois da limpeza voltam a aparecer normalmente (e somem após 31 dias).
- **Indicador discreto** na coluna de entregues: "N entregues ocultas · Mostrar", que exibe temporariamente as ocultas só para quem clicou (sem desfazer a limpeza).

## Regras
- Uma demanda entregue some do Kanban quando: foi entregue há mais de 31 dias **ou** foi entregue antes da última limpeza do quadro.
- Demandas não entregues nunca são ocultadas.
- Só o Kanban do quadro é afetado; lista de Demandas, Sprints, relatórios, dashboard e agente do quadro continuam vendo tudo.

## Detalhes técnicos
- Migração: coluna `boards.kanban_cleared_at timestamptz` (nula por padrão). Atualização via RPC `clear_board_kanban(_board_id)` SECURITY DEFINER que exige papel admin/moderator no quadro (`(select auth.uid())`), sem EXECUTE para anon; a mudança chega aos demais pelo realtime/invalidação do quadro.
- Regra pura em `src/lib/kanbanVisibility.ts` (`isHiddenFromKanban(demand, clearedAt, today)`, 31 dias, datas com `substring(0,10)`) + teste vitest com os casos: entregue há 31 vs 32 dias, entregue antes/depois da limpeza, aberta nunca oculta.
- `Kanban.tsx` aplica o filtro sobre `useDemands` antes dos filtros atuais; a demanda destacada ao voltar do detalhe continua visível. `useDemands`/`demands-read` não mudam (são compartilhados com a lista).
- `KanbanSnapshotDialog` passa a usar as demandas visíveis no Kanban no escopo "o que estou vendo".
- Novo componente `ClearBoardKanbanDialog` (AlertDialog) com as contagens; invalida `["board", id]` após confirmar.
