## Diagnóstico — por que o board fica branco

Mapeei as causas reais da tela em branco em cada troca de página:

1. **Suspense de rotas com fallback vazio** (`src/App.tsx` linha 124) — todo `import()` lazy de página renderiza `<div />` em branco enquanto o chunk JS baixa.
2. **Suspense interno do `ProtectedLayout`** (linha 262) também usa `<div />` vazia.
3. **Bloqueio por `isStatusLoading`** (trial+subscription) em `ProtectedLayout` — enquanto as queries de assinatura/trial carregam, o conteúdo da rota não renderiza (outra div vazia).
4. **Spinner full-page no Kanban** (`Kanban.tsx`): quando `useDemands.isLoading` é `true`, mostra spinner centralizado em vez de manter o layout do board (colunas/cards).
5. **`useDemands` pesado**: SELECT com 8 joins aninhados, sem `placeholderData`, sem `select` enxuto — qualquer troca de board volta a estado "loading" e o conteúdo some.
6. **`useDataPrecache`** dispara em background 15s após mount com `Promise.all` em 5 tabelas — pode competir com a primeira renderização, principalmente em redes lentas.
7. **Re-mount em troca de rota**: sem `keepPreviousData`/`placeholderData`, hooks como `useDemands(boardId)` voltam a `isLoading: true` quando o `boardId` muda, descartando os dados antigos.

## O que vou implementar

Mudanças focadas em **percepção de carregamento** e **manter conteúdo visível**, sem alterar regras de negócio.

### 1. Fallbacks com esqueleto (Suspense) em vez de div em branco
- Criar `src/components/skeletons/PageSkeleton.tsx` (header + grid de cards/colunas neutros usando `<Skeleton>` do shadcn).
- Criar `src/components/skeletons/KanbanSkeleton.tsx` (5 colunas com 3 cards-fantasma cada, respeitando layout real).
- Trocar o `Suspense` global do `App.tsx` por `PageSkeleton`.
- Trocar o `Suspense` interno do `ProtectedLayout` por `PageSkeleton` e manter a `TopLoadingBar` laranja já existente.

### 2. Não bloquear o Outlet por `isStatusLoading`
- Em `ProtectedLayout.tsx`, remover o gate `isStatusLoading ? <div/> : <Outlet/>`. O `canUseSystem` já tem fail-open por padrão; o status de trial/subscription pode ser revalidado em segundo plano sem esconder a página.

### 3. Manter dados anteriores em trocas (sem voltar a "loading")
- Em `useDemands`, `useBoards`, `useTeams`, `useDemandStatuses`, `useBoardStatuses` e `useDemandsList`: adicionar `placeholderData: (prev) => prev` (equivalente moderno de `keepPreviousData`) e elevar `staleTime` desses para 60s onde ainda não está.
- Resultado: ao trocar de board/equipe, o Kanban segue mostrando o conteúdo anterior com a barra laranja no topo até chegar o novo, em vez de virar branco.

### 4. Skeleton no Kanban em vez de spinner full-page
- Em `src/pages/Kanban.tsx`, quando `isLoading && !demands`, renderizar `<KanbanSkeleton />` mantendo header, filtros e a estrutura de colunas.
- Mesmo tratamento em `Demands.tsx`, `MyDemands.tsx`, `TeamDemands.tsx`, `Boards.tsx`, `Notes.tsx`, `Reports.tsx` — substituir spinners/`<div/>` por skeletons locais simples (linhas/cards `Skeleton`).

### 5. Adiar trabalho concorrente no primeiro paint
- `useDataPrecache`: aumentar o `setTimeout` inicial de 15s para 30s e mover para `requestIdleCallback` quando disponível, para não competir com as primeiras queries da página atual.

### 6. Prefetch de chunks ao passar o mouse / focar links de navegação
- Em `AppSidebar.tsx`, nos `NavLink`s principais (Kanban, Demands, Boards, Notes, MyDemands, TeamDemands, Reports, Profile, Settings), disparar `onMouseEnter`/`onFocus` que chamam o `() => import("./pages/X")` correspondente, registrando os imports via um pequeno mapa em `src/lib/routePrefetch.ts`. Isso elimina a maior parte da espera por chunk em navegações reais.

## Arquivos afetados

```text
src/App.tsx                                # Suspense fallback = PageSkeleton
src/components/ProtectedLayout.tsx         # remove gate isStatusLoading + Suspense com PageSkeleton
src/components/AppSidebar.tsx              # prefetch nos NavLinks
src/components/skeletons/PageSkeleton.tsx        # NOVO
src/components/skeletons/KanbanSkeleton.tsx      # NOVO
src/components/skeletons/ListSkeleton.tsx        # NOVO (reaproveitado por Demands/Notes/etc.)
src/lib/routePrefetch.ts                   # NOVO — mapa de prefetch
src/hooks/useDemands.ts                    # placeholderData + staleTime
src/hooks/useBoards.ts                     # placeholderData + staleTime
src/hooks/useTeams.ts                      # placeholderData + staleTime
src/hooks/useBoardStatuses.ts              # placeholderData
src/hooks/useDemandsList.ts                # placeholderData
src/hooks/useDataPrecache.ts               # delay 30s + requestIdleCallback
src/pages/Kanban.tsx                       # KanbanSkeleton no isLoading
src/pages/Demands.tsx, MyDemands.tsx,      # ListSkeleton no isLoading
   TeamDemands.tsx, Boards.tsx, Notes.tsx,
   Reports.tsx
```

## Resultado esperado

- Nenhuma transição cai mais em "tela 100% branca": ou aparece skeleton, ou permanece o conteúdo anterior com a barra laranja correndo no topo.
- Troca de board no Kanban deixa de "piscar" para vazio.
- O carregamento real fica perceptualmente ~50% mais rápido, mesmo sem reduzir o tempo absoluto das queries (que já foi atacado nas migrações anteriores).
- Zero mudanças em regras de negócio, RLS, schema ou Edge Functions.

Posso seguir com a implementação?
