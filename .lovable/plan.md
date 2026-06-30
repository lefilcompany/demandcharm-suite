## Diagnóstico

O projeto **já tem** o sistema de carregamento offline funcional, com os mesmos 3 arquivos do SOMA+:

- `src/lib/offlineStorage.ts` — IndexedDB (`soma-offline-db` v2) com stores `demands`, `demandStatuses`, `teams`, `boards`, `profiles`, `services`, `syncQueue`, `cacheMetadata`. **Idêntico** ao SOMA+.
- `src/hooks/useSyncManager.ts` — fila de sync com retry (max 3). **Idêntico** ao SOMA+.
- `src/hooks/useDataPrecache.ts` — pré-cache acionado no `ProtectedLayout`. **Difere** do SOMA+.
- `src/hooks/useOfflineStatus.ts` — listener de status online/offline. **Idêntico**.

Os logs do console confirmam que está rodando sem erros (`Data precache completed at …`, `Connection restored, starting sync...`).

## Diferenças vs. SOMA+ (apenas em `useDataPrecache.ts`)

Foram ajustes feitos por mim em turnos anteriores para “não competir com o primeiro render”. Eles tornam o cache offline **menos completo e mais lento** que o do SOMA+:

| Item | Atual | SOMA+ |
| --- | --- | --- |
| Intervalo de refresh periódico | 30 min | 10 min |
| Intervalo mínimo entre runs | 10 min | 2 min |
| Limite de demandas pré-cacheadas | 200 | 500 |
| Cache de `profiles` | não busca | busca `id, full_name, avatar_url, email` |
| Início do primeiro pré-cache | `requestIdleCallback` / 30 s | 5 s após montar |

Resultado prático: hoje a primeira visita salva menos dados, demora muito mais para popular o IndexedDB e o cache nunca inclui perfis — exatamente o comportamento que o usuário quer evitar.

## Plano

Editar **só** `src/hooks/useDataPrecache.ts` para replicar o comportamento do SOMA+:

1. `CACHE_REFRESH_INTERVAL = 10 * 60 * 1000` e `MIN_PRECACHE_INTERVAL = 2 * 60 * 1000`.
2. Voltar o `Promise.all` a buscar também `profiles` (`id, full_name, avatar_url, email`) e salvar via `saveProfiles`.
3. Aumentar o `.limit(200)` de demandas para `.limit(500)`.
4. Trocar o agendamento inicial (`requestIdleCallback` / fallback de 30 s) por um `setTimeout(..., 5000)` simples, como no SOMA+.

Nenhuma alteração em `offlineStorage.ts`, `useSyncManager.ts`, `useOfflineStatus.ts`, `ProtectedLayout.tsx`, `useDemands.ts`, `CreateDemand.tsx`, `KanbanBoard.tsx` ou `SidebarSyncIndicator.tsx` — tudo já está igual ao SOMA+.

## Detalhes técnicos

```ts
// src/hooks/useDataPrecache.ts (trecho final)
const CACHE_REFRESH_INTERVAL = 10 * 60 * 1000;
const MIN_PRECACHE_INTERVAL  = 2  * 60 * 1000;

// dentro de precacheUserData:
const [statusesResult, teamsResult, boardsResult, demandsResult, servicesResult, profilesResult] =
  await Promise.all([
    supabase.from('demand_statuses').select('*'),
    supabase.from('teams').select('*'),
    supabase.from('boards').select('*'),
    supabase.from('demands').select(`*, status:demand_statuses(*), service:services(*),
      creator:profiles!demands_created_by_fkey(id, full_name, avatar_url),
      assignee:profiles!demands_assigned_to_fkey(id, full_name, avatar_url)`)
      .eq('archived', false).order('updated_at', { ascending: false }).limit(500),
    supabase.from('services').select('*'),
    supabase.from('profiles').select('id, full_name, avatar_url, email'),
  ]);
if (profilesResult.data) savePromises.push(saveProfiles(profilesResult.data));

// initial run
useEffect(() => {
  if (user) {
    const timer = setTimeout(() => precacheUserData(), 5000);
    return () => clearTimeout(timer);
  }
}, [user?.id]);
```

## Verificação

Após aplicar, conferir no console:
- 1ª linha `Data precache completed at …` aparece ~5 s depois do login (antes só após idle/30 s).
- DevTools → Application → IndexedDB → `soma-offline-db` mostra as 6 stores populadas, incluindo `profiles`.
- Nenhum erro novo após `vite` recarregar.
