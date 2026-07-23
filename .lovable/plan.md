# Fix: solicitações aprovadas voltando para "Pendentes"

## Regra de negócio confirmada

**Quem aprova solicitações são os admins e coordenadores do quadro** (papéis de quadro `admin` e `moderator`), não os admins da equipe. A UI já reflete isso:

```ts
// src/pages/DemandRequests.tsx:141
const canApproveOrReturn = boardRole === "admin" || boardRole === "moderator";
```

O plano abaixo alinha o backend a essa regra.

## Diagnóstico (causa raiz)

A política RLS de **UPDATE** em `demand_requests` hoje só permite admin/moderador da **equipe**:

```
"Admins and moderators can update team requests"
USING: is_team_admin_or_moderator(auth.uid(), team_id)
```

Quando o aprovador é admin/coordenador do **quadro** mas não da equipe (caso comum: papel de equipe `executor`/`requester`), o `useApproveDemandRequest` executa:

1. Cria a demanda em `demands` — passa (policy de INSERT só exige membership de quadro).
2. Copia anexos e materializa subdemandas.
3. `UPDATE demand_requests SET status='approved' WHERE id = requestId` — **RLS bloqueia silenciosamente**: PostgREST não retorna erro, apenas 0 linhas afetadas.

Resultado: a demanda aparece em `/demands`, o toast de sucesso é mostrado, mas a solicitação continua `pending`. Ao reabrir a tela de Solicitações, ela "volta" para Pendentes. Bate exatamente com o sintoma.

Bug colateral: `useUpdateDemandRequest` força `status: "pending"` em **qualquer** edição da solicitação — risco de regressão futura, corrigir junto.

## Mudanças

### 1) Migration — RLS baseada no papel de quadro

Substituir as políticas team-scope por políticas que reconheçam admin/coordenador do quadro como aprovador legítimo:

```sql
DROP POLICY "Admins and moderators can update team requests" ON public.demand_requests;
DROP POLICY "Admins and moderators can view team requests"   ON public.demand_requests;

-- Admin/coordenador do quadro (ou da equipe) veem as solicitações
CREATE POLICY "Board approvers can view requests"
  ON public.demand_requests FOR SELECT
  USING (
    public.is_team_admin_or_moderator(auth.uid(), team_id)
    OR (board_id IS NOT NULL AND public.is_board_admin_or_moderator(auth.uid(), board_id))
  );

-- Somente admin/coordenador do quadro (ou da equipe) podem aprovar/devolver
CREATE POLICY "Board approvers can update requests"
  ON public.demand_requests FOR UPDATE
  USING (
    public.is_team_admin_or_moderator(auth.uid(), team_id)
    OR (board_id IS NOT NULL AND public.is_board_admin_or_moderator(auth.uid(), board_id))
  );
```

A policy existente "Board members can view requests for their boards" continua atendendo os demais membros (executores/solicitantes) que só precisam visualizar.

### 2) `src/hooks/useDemandRequests.ts` — falhar alto em vez de silenciosamente

Em `useApproveDemandRequest`, trocar o UPDATE final por uma versão que retorna a linha e detecta 0 linhas (defesa em profundidade caso RLS bloqueie no futuro):

```ts
const { data: updated, error: updateError } = await supabase
  .from("demand_requests")
  .update({
    status: "approved",
    responded_by: user.id,
    responded_at: new Date().toISOString(),
  })
  .eq("id", requestId)
  .select("id")
  .maybeSingle();

if (updateError) throw updateError;
if (!updated) {
  throw new Error(
    "Não foi possível aprovar a solicitação: você não tem permissão de aprovador neste quadro."
  );
}
```

Aplicar o mesmo padrão (`.select().maybeSingle()` + checagem de linha) em `useReturnDemandRequest`.

### 3) `useUpdateDemandRequest` — não zerar aprovações por engano

Só forçar `status: "pending"` (fluxo de reenvio) quando a solicitação atual estiver `returned`. Caso contrário, preservar o status existente:

```ts
mutationFn: async ({ id, ...data }) => {
  const { data: current } = await supabase
    .from("demand_requests").select("status").eq("id", id).single();

  const patch: Record<string, unknown> = { ...data };
  if (current?.status === "returned") {
    patch.status = "pending";
    patch.rejection_reason = null;
  }

  const { data: result, error } = await supabase
    .from("demand_requests").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return result;
}
```

## Verificação

1. Logar como usuário que é **admin/coordenador do quadro** mas **não** admin/moderador da equipe.
2. Abrir uma solicitação pendente → "Aprovar e Criar".
3. Esperado: demanda aparece em `/demands` e a solicitação some da aba "Pendentes", aparecendo em "Aprovadas" — não retorna à lista pendente.
4. Repetir com admin de equipe — comportamento inalterado.
5. Editar solicitação `pending` como admin — status permanece `pending`. Editar `returned` (reenvio) — vira `pending` como antes.
