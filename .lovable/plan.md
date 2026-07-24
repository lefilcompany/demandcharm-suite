
## Problema

Hoje qualquer membro alocado em um quadro recebe email de toda movimentação do quadro (mudanças de status, comentários, atribuições em demandas em que ele nem participa). Isso gera ruído e custo. Além disso, a aba de Notificações em Configurações tem apenas 5 switches genéricos (`demandUpdates`, `teamUpdates`, `deadlineReminders`, `adjustmentRequests`, `mentionNotifications`), sem separar por canal (email / push FCM / in-app) nem por tipo específico de evento.

## Objetivo

1. Reformular a aba **Configurações → Notificações** como três blocos de canal (E-mail, Push FCM, In-app), cada um com um switch mestre e, ao ativar, expõe granularmente cada tipo de evento.
2. Adicionar escopo estilo YouTube por **quadro**: "Todas as demandas do quadro" ou "Apenas demandas em que sou responsável/acompanhante" (padrão).
3. Mudar o **default global** para o escopo restrito: por padrão o usuário só é notificado de eventos em demandas que ele participa. Isso resolve o volume de emails atual.

## Escopo do plano

Somente presentação + filtro de disparo. Não altero as edge functions de envio (`send-email`, `send-push-notification`), apenas os call-sites no frontend que decidem *se* devem disparar.

## Mudanças

### 1. Modelo de preferências (`src/hooks/useNotificationPreferences.ts`)

Substituir a forma plana por uma matriz canal × tipo:

```ts
type Channel = "email" | "push" | "inapp";
type EventType =
  | "demandAssigned"        // fui colocado como responsável/acompanhante
  | "demandStatusChanged"   // mudança de coluna/status
  | "demandComment"         // mensagens no chat da demanda
  | "demandMention"         // @ em mensagem
  | "demandAdjustment"      // solicitação de ajuste
  | "demandApproval"        // aprovação interna/cliente
  | "demandDeadline"        // lembrete de prazo
  | "boardMembership"       // adicionado/removido de quadro
  | "teamUpdates"           // novos membros, mudanças na equipe
  | "requestApproval";      // aprovação de solicitação de demanda

interface NotificationPreferences {
  channels: {
    email:  { enabled: boolean; types: Record<EventType, boolean> };
    push:   { enabled: boolean; types: Record<EventType, boolean> };
    inapp:  { enabled: boolean; types: Record<EventType, boolean> };
  };
  // escopo padrão para eventos "de quadro"
  defaultScope: "all" | "assigned_only"; // default: "assigned_only"
  // overrides por quadro (YouTube-style)
  boardScopes: Record<string /*boardId*/, "all" | "assigned_only" | "off">;

  // preservados
  approvalNotifyMode: "ask" | "all" | "none";
  approvalNotifyIncludeCreator: boolean;
}
```

Migração leve em runtime: se `preference_value` estiver no formato antigo (com `emailNotifications`, `pushNotifications`, `demandUpdates`, etc.), converto para o novo shape no `useQuery` (não precisa de migração SQL — o campo é JSONB).

**Default novo:**
- Todos os canais ativos, todos os tipos ativos.
- `defaultScope: "assigned_only"` → resolve o problema atual de ruído.
- `boardScopes: {}`.

### 2. UI (`src/components/settings/NotificationsSection.tsx`)

Substituir a lista atual por:

- 3 cards colapsáveis (`Collapsible` do shadcn), um por canal:
  - Header: ícone (Mail / Bell / Smartphone), título, descrição curta, `Switch` mestre à direita.
  - Ao ativar → expande e mostra a grade de tipos de evento (checkbox por linha com label e descrição).
  - Desativado → colapsado, tipos ficam ocultos/desabilitados.
- Bloco "Notificações do Navegador" (permissão FCM do dispositivo) permanece dentro do card Push.
- Bloco "Escopo padrão de notificações" com radio: *Todas as demandas dos meus quadros* / *Apenas demandas em que sou responsável ou acompanhante* (padrão).
- Bloco "Por quadro" (`BoardScopeList`, novo subcomponente): lista os quadros do usuário (via `useBoards`) com um select por linha `Todas | Apenas minhas | Silenciar`, seguindo o padrão YouTube. Vazio até o usuário customizar.
- Bloco "Aprovações" preservado como está.

### 3. Helper central de filtragem

Criar `src/lib/notificationDispatch.ts` com:

```ts
shouldNotifyUser(userId, prefs, {
  channel: "email"|"push"|"inapp",
  type: EventType,
  boardId?: string,
  isUserAssigned?: boolean,   // se o alvo é responsável/acompanhante da demanda
}): boolean
```

Regras:
1. Se `channels[channel].enabled === false` → false.
2. Se `channels[channel].types[type] === false` → false.
3. Se o evento é de escopo de quadro e temos `boardId`:
   - scope = `boardScopes[boardId] ?? defaultScope`.
   - `off` → false; `assigned_only` → só se `isUserAssigned`; `all` → true.
4. Caso contrário true.

### 4. Aplicar o filtro nos disparadores

Nos arquivos abaixo, antes de chamar `sendEmail` / `sendPushNotification` / inserir em `notifications`, buscar as prefs do destinatário (`user_preferences` por `user_id`) e aplicar `shouldNotifyUser`:

- `src/lib/demandAssigneeNotifications.ts` (`demandAssigned`)
- `src/lib/approvalNotifications.ts` (`demandApproval`)
- `src/lib/boardMemberNotifications.ts` (`boardMembership`)
- `src/components/DemandChat.tsx` (`demandComment`, `demandMention`)
- `src/components/KanbanBoard.tsx` (`demandStatusChanged`)
- `src/components/KanbanAdjustmentDialog.tsx` (`demandAdjustment`)
- `src/hooks/useDemandRequests.ts` (`requestApproval`)

Para cada destinatário, verificar se ele está em `demand_assignees` da demanda em questão (usado como `isUserAssigned`). Uma query batch por evento é suficiente (`select user_id from demand_assignees where demand_id = ...`).

`check-deadlines` (edge function) e `send-email`/`send-push-notification` **não** são alterados — o filtro fica no frontend/callers. Para deadlines, adiciono o filtro apenas no call-site que já roda no cliente; a edge function segue enviando para quem for elegível conforme já é hoje (fora do escopo desta iteração; pode ser tratado depois se necessário).

### 5. Persistência

Mesma tabela `user_preferences`, mesma key `notification_preferences`, apenas com JSON no novo shape. Sem migração SQL.

## Fora do escopo

- Não vou tocar em `send-email` / `send-push-notification` / `check-deadlines`.
- Não vou criar novas tabelas.
- Não vou mudar o comportamento de aprovações (`approvalNotifyMode`).

## Arquivos

- Alterar: `src/hooks/useNotificationPreferences.ts`, `src/components/settings/NotificationsSection.tsx`, `src/lib/demandAssigneeNotifications.ts`, `src/lib/approvalNotifications.ts`, `src/lib/boardMemberNotifications.ts`, `src/components/DemandChat.tsx`, `src/components/KanbanBoard.tsx`, `src/components/KanbanAdjustmentDialog.tsx`, `src/hooks/useDemandRequests.ts`.
- Novo: `src/lib/notificationDispatch.ts`, `src/components/settings/BoardScopeList.tsx`.
