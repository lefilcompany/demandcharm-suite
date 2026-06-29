## Objetivo

Remover o carregamento com logo + skeletons (ContentLoader) e replicar exatamente a estratégia leve do projeto SOMA+ original, que evita re-render visível e exibe apenas um spinner mínimo / fallback vazio durante transições.

## Mudanças

### 1. `src/App.tsx`
- Remover `import { ContentLoader }`.
- Trocar o `<Suspense fallback={<ContentLoader />}>` que envolve `<Routes>` pelo fallback vazio usado no SOMA+:
  ```tsx
  <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center" />}>
  ```

### 2. `src/components/ProtectedLayout.tsx`
- Remover `import { Suspense } from "react"` (manter apenas `useState, useEffect`).
- Remover `import { ContentLoader }`.
- Substituir o branch `if (trialLoading || subLoading)` pelo mesmo do SOMA+:
  ```tsx
  if (trialLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  ```
- Remover o `<Suspense fallback={<ContentLoader />}>` em volta do `<Outlet />`, deixando apenas:
  ```tsx
  <div className="flex-1 overflow-y-auto min-h-0 p-3 md:p-6">
    <Outlet />
  </div>
  ```

### 3. `src/components/ContentLoader.tsx`
- Deletar o arquivo (não há mais consumidores).

## Resultado

- Sem logo girando durante navegação.
- Transições de rota ficam instantâneas (fallback vazio mantém o shell intacto enquanto o chunk carrega — graças ao `staleTime` 3min e ao precache já configurados).
- Loading de trial/subscription usa apenas o spinner enxuto do SOMA+.
- Mantidas as otimizações já aplicadas (índices, React Query, precache).
