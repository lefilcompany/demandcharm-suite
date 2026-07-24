# Corrigir erro "Cannot coerce the result to a single JSON object"

## Diagnóstico

O erro vem do PostgREST quando `.single()` recebe 0 (ou mais de 1) linhas. No caso do rename de quadro, `useUpdateBoard` faz:

```ts
supabase.from("boards").update(...).eq("id", input.id).select().single();
```

Se o UPDATE não retorna a linha (RLS filtra o SELECT pós-update, política de UPDATE bloqueia silenciosamente, ou o id não bate), o `.single()` explode com essa mensagem confusa em vez de uma mensagem clara pro usuário. O padrão do projeto (memory `single-query-errors`) já diz para preferir `.maybeSingle()` — várias mutações ainda usam `.single()`.

## Escopo

Ajustar as mutações client-side que fazem `insert/update/delete ... .select().single()` para:

1. Usar `.maybeSingle()` no lugar de `.single()`.
2. Quando `data` vier `null` sem `error`, lançar um erro de negócio claro ("Não foi possível atualizar o quadro. Verifique se você tem permissão."), em vez de deixar o PostgREST estourar.
3. Manter o comportamento de sucesso idêntico (mesmo shape retornado ao `onSuccess`).

Foco (entidades que o usuário edita/cria pela UI e que apresentam o mesmo padrão frágil):

- `src/hooks/useBoards.ts` — `useUpdateBoard` (causa reportada).
- `src/hooks/useDemands.ts` — create/update/duplicate.
- `src/hooks/useTeams.ts` — create/update.
- `src/hooks/useBoardMembers.ts`, `useBoardStatuses.ts`, `useBoardServices.ts` — mutações update/upsert.
- `src/hooks/useDemandRequests.ts`, `useDemandAssignees.ts`, `useDemandFolders.ts`, `useSubdemands.ts`, `useSubtasks.ts` — updates/inserts.
- `src/hooks/useNotes.ts`, `useNoteShares.ts`, `useNoteTags.ts`, `useShareNote.ts`, `useShareDemand.ts` — updates.
- `src/hooks/useServices.ts`, `useTemplates.ts`, `useContracts.ts`, `useRecurringDemands.ts`, `useTeamPositions.ts`, `useTeamJoinRequests.ts` — updates.
- `src/hooks/admin/useAdminPlans.ts`, `useAdminCoupons.ts` — updates.

Não vou tocar:

- Fluxos onde `.single()` faz sentido semântico e é seguido de tratamento explícito (ex.: leituras que exigem existir).
- `src/hooks/useSyncManager.ts` (fila offline — já tem tratamento próprio).
- Edge functions e código server (usam service role, comportamento diferente).

## Detalhes técnicos

Padrão de troca:

```ts
const { data, error } = await supabase
  .from("boards")
  .update(patch)
  .eq("id", id)
  .select()
  .maybeSingle();

if (error) throw new Error(error.message);
if (!data) {
  throw new Error("Não foi possível atualizar o quadro. Verifique suas permissões.");
}
```

Mensagens de "não encontrado/sem permissão" serão específicas por entidade (quadro, demanda, equipe, etc.) para o toast já existente exibi-las corretamente.

Sem migração de banco — a correção é puramente client-side. RLS/policies permanecem intactas.

## Verificação

- `tsgo` (typecheck) após a edição.
- Fluxo manual pela preview: renomear um quadro como owner → sucesso; simular sem permissão → toast claro em português em vez de erro cru.
