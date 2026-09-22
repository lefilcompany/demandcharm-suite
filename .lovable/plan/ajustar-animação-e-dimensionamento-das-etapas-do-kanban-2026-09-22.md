# Ajustar animação e dimensionamento das etapas do Kanban

## Contexto atual

No `src/components/KanbanBoard.tsx`, as colunas (etapas) do Kanban são renderizadas em dois blocos quase idênticos:

- **Tablet/small desktop** (linhas ~2509–2626): largura aberta fixa `360px`.
- **Large desktop** (linhas ~2628–2752): largura aberta fixa `380px`.

Em ambos, o card de uma etapa **fechada** usa:
```text
"p-2 cursor-pointer flex-1 hover:flex-[2.2] hover:shadow-lg"
"transition-all duration-700 ease-in-out"
```
Ou seja: ao passar o mouse, a coluna **expande** de `flex-1` para `flex-[2.2]` e ganha uma sombra forte. Ao clicar para abrir, ela passa para uma **largura fixa** (360/380px), que é **menor** que o tamanho expandido do hover — por isso o card "encolhe" ao abrir.

## O que o usuário quer

1. **Hover = highlight suave** (não expansão). Hoje o hover expande o card e joga uma sombra pesada; deve ser apenas um realce sutil (leve mudança de fundo/borda + sombra suave), sem alterar o tamanho.
2. **Abrir = permanecer no tamanho expandido.** Ao abrir a etapa, ela deve ficar no tamanho expandido (o `flex-[2.2]` que o hover produzia hoje), em vez de recolher para a largura fixa de 360/380px. Assim, ao clicar enquanto o hover está ativo, o card não encolhe.

## Mudanças (apenas em `src/components/KanbanBoard.tsx`)

Aplicar nos dois blocos (tablet ~linha 2541 e large desktop ~linha 2659), de forma idêntica:

### 1. Coluna fechada — hover vira highlight suave

De:
```text
isActive ? "p-4" : "p-2 cursor-pointer flex-1 hover:flex-[2.2] hover:shadow-lg",
```
Para:
```text
isActive ? "p-4" : "p-2 cursor-pointer flex-1 hover:flex-[2.2] hover:bg-primary/5 hover:shadow-md",
```

Aguarda — isso ainda expande. O ponto 1 pede para **não** expandir no hover. Então o hover passa a ser só highlight, e a expansão fica só no estado aberto:

Para (final):
```text
isActive ? "p-4" : "p-2 cursor-pointer flex-1 hover:bg-primary/5 hover:shadow-md",
```

- Remove `hover:flex-[2.2]` (hover não expande mais).
- Remove `hover:shadow-lg` → `hover:shadow-md` (sombra mais suave).
- Adiciona `hover:bg-primary/5` (realce sutil da cor da marca).

### 2. Coluna aberta — permanece no tamanho expandido

Hoje o estado aberto usa largura fixa via `style` inline:
```text
isActive ? { width: `${openColumnWidth}px`, minWidth: `${openColumnWidth}px`, flexShrink: 0 }
         : { minWidth: `${closedColumnMinWidth}px` }
```

Trocar para que a coluna aberta use `flex-[2.2]` (mesmo tamanho que o hover expandia), removendo a largura fixa:
```text
isActive ? { flex: "2.2", minWidth: `${closedColumnMinWidth}px` }
         : { minWidth: `${closedColumnMinWidth}px` }
```

E no `className`, o estado ativo passa a incluir `flex-[2.2]` para refletir o mesmo ratio em CSS (mantendo `p-4`).

Assim:
- Fechada: `flex-1`.
- Hover (fechada): `flex-1` + highlight suave (sem expandir).
- Aberta: `flex-[2.2]` (tamanho expandido, igual ao hover antigo).

Ao clicar para abrir, o card cresce de `flex-1` para `flex-[2.2]` — não encolhe. O `transition-all duration-700 ease-in-out` já existente cuida da animação suave.

## Notas / riscos

- A largura das colunas abertas deixa de ser fixa (360/380px) e passa a ser proporcional (`flex-[2.2]`). Com várias colunas abertas ao mesmo tempo, cada uma fica proporcionalmente menor — mas esse é exatamente o comportamento de "permanecer no tamanho expandido" pedido.
- O comentário atual sobre "increased for full timer display" (360/380px fixos) deixa de valer; o timer continuará cabendo porque a coluna aberta é a maior da tela.
- Sem mudança em `toggleColumn`, mobile, ou drag-and-drop. Apenas visual/CSS.

## Validação

- `npx tsgo --noEmit` (apenas confirma que não quebrei tipos — a mudança é só className/style).
- Playwright: abrir o Kanban em viewport desktop (1280px+), fazer hover em uma etapa fechada (confirmar highlight suave, sem expansão) e clicar para abrir (confirmar que a coluna cresce para o tamanho expandido e não encolhe).
