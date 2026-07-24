
## Diagnóstico

1. **Falta de notificação ao alocar responsável/seguidor**
   Em `src/hooks/useDemandAssignees.ts` a mutation `useSetAssignees` (usada em `DemandEditForm` e `SubdemandEditForm`) só faz `INSERT/DELETE/UPDATE is_primary` — não dispara nenhum canal (in‑app, push, e‑mail). Por isso ninguém recebe e‑mail ao ser alocado como responsável ou seguidor, promovido a primário ou removido. As demais mutations (`useAddAssignee`, `useRemoveAssignee`) também não notificam.

2. **"Resend mostra Delivered mas não chega"**
   A tela do Resend confirma que o provedor entregou ao servidor destino (lefil.com.br). Não é problema de código nem de DNS — os e‑mails que aparecem como `Delivered` foram aceitos pelo MX do destinatário. O que não chega na caixa provavelmente está caindo em **Spam/Quarentena** do Google Workspace do lefil.com.br, ou está bloqueado por filtro corporativo. Nada a corrigir no código; ver "Ações do usuário" no fim.

## Mapeamento atual de e‑mails (todos usam a edge `send-email` → Resend gateway, remetente `SoMA+ <soma@lefil.com.br>`, template único `notification`)

| # | Evento | Onde dispara | Destinatário | Cobertura hoje |
|---|--------|--------------|--------------|----------------|
| 1 | Nova mensagem no chat da demanda | `src/components/DemandChat.tsx` | Criador + responsáveis + seguidores | OK |
| 2 | Menção @ no chat | `src/components/DemandChat.tsx` | Usuário mencionado | OK |
| 3 | Novo anexo na demanda | `src/components/AttachmentUploader.tsx` | Criador da demanda | OK |
| 4 | Mudança de status (Kanban drag/drop) | `src/components/KanbanBoard.tsx` (2 pontos) | Criador da demanda | OK |
| 5 | Ajuste solicitado (adjustment) | `src/components/KanbanAdjustmentDialog.tsx`, `src/pages/DemandDetail.tsx` | Responsáveis + criador | OK |
| 6 | Aprovações (interna/cliente) | `src/lib/approvalNotifications.ts` + `autoApprovalNotify.ts` | Aprovadores configurados | OK |
| 7 | Adicionado / removido / cargo alterado em quadro | `src/hooks/useBoardMembers.ts` → `src/lib/boardMemberNotifications.ts` | Membro afetado | OK |
| 8 | Deadline se aproximando / vencida | edge `check-deadlines` | Responsáveis | OK |
| 9 | Nova solicitação de demanda (requester) | edge `notify-demand-request` | Admins/coords do quadro | OK |
| 10 | Push notifications espelhadas | edge `send-push-notification` → chama `send-email` | Destinatários do push | OK |
| 11 | **Alocado como responsável primário** | *nenhum* | — | **FALTANDO** |
| 12 | **Adicionado como seguidor (responsável não‑primário)** | *nenhum* | — | **FALTANDO** |
| 13 | **Promovido a responsável primário** | *nenhum* | — | **FALTANDO** |
| 14 | **Removido dos responsáveis da demanda** | *nenhum* | — | **FALTANDO** |

## Correções

### 1. Criar helper `src/lib/demandAssigneeNotifications.ts`
Espelhando o padrão de `boardMemberNotifications.ts`, com 4 eventos: `assigned_primary`, `assigned_follower`, `promoted_primary`, `unassigned`. Cada evento dispara em paralelo, sem bloquear entre si:
- **In‑app**: `notifications` insert (título/mensagem/link `/demands/{id}`, tipo `info`/`warning`).
- **Push**: `sendPushNotification` com `notificationType: "demandUpdates"`.
- **E‑mail**: `supabase.functions.invoke("send-email", { to: userId, template: "notification", ... })` — a edge já resolve UUID→e‑mail, respeita `emailNotifications` e valida `actionUrl` no domínio permitido.

Não notifica o próprio ator (`userId === actorId`).

Textos (PT‑BR), incluindo nome do quadro entre colchetes no push/e‑mail para consistência com padrão atual:
- `assigned_primary` — "Você foi definido como responsável pela demanda '{título}'"
- `assigned_follower` — "Você foi adicionado como seguidor da demanda '{título}'"
- `promoted_primary` — "Você agora é o responsável principal da demanda '{título}'"
- `unassigned` — "Você foi removido da demanda '{título}'"

### 2. Instrumentar `useSetAssignees` em `src/hooks/useDemandAssignees.ts`
Após o bloco de mutations, antes do `onSuccess`, calcular diffs e disparar `notifyDemandAssigneeChange` para cada usuário afetado:
- Adicionados que viraram primário → `assigned_primary`.
- Adicionados não‑primários → `assigned_follower`.
- Já existente que mudou de não‑primário para primário → `promoted_primary`.
- Removidos → `unassigned`.

Buscar título/quadro da demanda com um único `select("title, board_id, boards(name)")` para compor mensagens. Buscar nome do ator via `profiles.full_name` (já disponível padrão pelo hook `useAuth` do chamador — passamos actor pelo `supabase.auth.getUser()` que já é chamado dentro do hook).

Também instrumentar `useAddAssignee` (evento `assigned_follower`) e `useRemoveAssignee` (`unassigned`) para consistência caso sejam usados no futuro.

### 3. Não alterar
- Nenhum outro fluxo de e‑mail (mapeamento # 1–10 permanece igual).
- Nenhum arquivo de UI — a mudança é só no hook e no novo helper.

## Detalhes técnicos

- Arquivos alterados:
  - `src/hooks/useDemandAssignees.ts` — adiciona coleta de diffs e disparo do helper.
  - `src/lib/demandAssigneeNotifications.ts` — **novo**.
- Sem migrations, sem alterações na edge `send-email` (já aceita `to` como UUID e valida payload).
- Falhas de notificação não bloqueiam o resultado da mutation (mesmo padrão do `boardMemberNotifications`), apenas `console.warn`.

## Ações do usuário (deliverability)

Fora do escopo de código, para os e‑mails que aparecem como "Delivered" mas não chegam ao seu inbox `lefil.com.br`:
1. Checar Spam/Quarentena no Google Workspace.
2. Adicionar `soma@lefil.com.br` como remetente confiável / criar filtro "Nunca enviar para Spam".
3. No Admin do Workspace, verificar em **Segurança → Investigação de e‑mail** o que aconteceu com uma mensagem específica (usar o `Message ID` do Resend).
