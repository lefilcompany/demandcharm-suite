# Snapshot do Kanban por quadro (PDF + planilha)

Um botão "Baixar resumo" na tela do Kanban gera um retrato da situação atual do quadro: quantas demandas há em cada etapa, quem é o responsável por cada uma, prazos, atrasos, prioridade e serviço.

## O que o usuário vê

1. Na barra de ações do Kanban (ao lado dos filtros), um botão **Baixar resumo**.
2. Ao clicar, abre uma janela curta com:
   - Escolha do que incluir: **Somente o que estou vendo (filtros aplicados)** ou **Quadro inteiro**.
   - Escolha do formato: **PDF** ou **Planilha (CSV)**.
   - Um resumo prévio: "X demandas, Y atrasadas, Z pessoas envolvidas".
3. O arquivo baixa na hora, com nome tipo `resumo-kanban-<quadro>-2026-09-08.pdf`.
4. Disponível para todos os membros do quadro, inclusive solicitantes (cada um baixa apenas as demandas que já enxerga na tela).

## Conteúdo do resumo

Cabeçalho: nome do quadro, data e hora da geração, escopo (filtrado ou completo), autor.

Blocos:
1. **Panorama** — total de demandas, entregues, em andamento, atrasadas, a vencer em 7 dias.
2. **Por etapa** — cada coluna do Kanban com a contagem e a participação percentual.
3. **Por responsável** — pessoa, total de demandas, quantas em cada etapa-chave, quantas atrasadas.
4. **Detalhamento das demandas** — agrupado por etapa, uma linha por demanda: código, título, responsável (e seguidores quando houver), prioridade, serviço, prazo, marcação de atraso.

Na planilha, os mesmos blocos viram abas/seções: `Panorama`, `Por etapa`, `Por responsável`, `Demandas`.

## Direção visual

O PDF segue o estilo já existente dos relatórios do SoMA+ (`src/lib/pdfExport.ts`): capa com marca, laranja #F28705 nos cabeçalhos, texto grafite #1D1D1D.

Ajustes próprios deste documento:
- Cada etapa abre com uma faixa colorida usando a cor real da coluna no quadro, então o papel "lê" como o Kanban.
- Prioridade aparece como pílula sólida (verde/amarelo/vermelho), igual aos cartões.
- Demandas atrasadas ganham a data em vermelho com o número de dias de atraso.
- Rodapé com paginação e data de geração.

## Detalhes técnicos

- Novo `src/lib/kanbanSnapshot.ts`: recebe as colunas (`useKanbanColumns`) e as demandas já filtradas ou completas e devolve a estrutura agregada (panorama, por etapa, por responsável, lista detalhada). Sem chamadas novas ao banco — reaproveita `useDemands`, `useBoardMembers`/`demand_assignees` e `useServices` já carregados na página.
- Novo `src/lib/kanbanSnapshotPdf.ts`: gera o PDF com jsPDF + autoTable, reutilizando as constantes de cor e o cabeçalho de `src/lib/pdfExport.ts`.
- Novo `src/components/KanbanSnapshotDialog.tsx`: diálogo com escopo/formato e os dois botões de download; CSV com BOM UTF-8 (mesmo padrão de `ExportReportButton.tsx`).
- `src/pages/Kanban.tsx` passa a lista filtrada e a lista completa para o diálogo, junto com nome do quadro e colunas.
- Nomes de responsáveis vêm dos assignees com `is_primary = true`; seguidores listados separadamente. Demandas sem responsável aparecem como "Sem responsável".
- Datas formatadas com `substring(0, 10)` antes de virar `Date`, conforme o padrão do projeto.
- Sem mudanças no banco, em permissões ou no MCP.
