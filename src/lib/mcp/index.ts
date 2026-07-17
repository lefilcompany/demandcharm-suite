import { auth, defineMcp } from "@lovable.dev/mcp-js";

// Session
import { whoamiTool, getProfileTool, updateProfileTool } from "./tools/session";
// Teams
import {
  listMyTeamsTool, getTeamTool, listTeamMembersTool, listTeamPositionsTool,
  joinTeamWithCodeTool, getPlanLimitsTool,
} from "./tools/teams";
// Boards
import {
  listBoardsTool, getBoardTool, createBoardTool, updateBoardTool, archiveBoardTool,
  listBoardMembersTool, addBoardMemberTool, updateBoardMemberRoleTool, removeBoardMemberTool,
  listBoardStatusesTool, listBoardServicesTool, attachServiceToBoardTool,
} from "./tools/boards";
// Demands
import {
  listDemandsTool, searchDemandsTool, getDemandTool, createDemandTool, updateDemandTool,
  moveDemandTool, assignDemandTool, addFollowerTool, removeFollowerTool, addDependencyTool,
  archiveDemandTool, deleteDemandTool, createDemandWithSubdemandsTool,
} from "./tools/demands";
// Subtasks
import {
  listSubtasksTool, createSubtaskTool, toggleSubtaskTool, updateSubtaskTool, deleteSubtaskTool,
} from "./tools/subtasks";
// Comments
import { listCommentsTool, postCommentTool, deleteCommentTool } from "./tools/comments";
// Attachments
import {
  listAttachmentsTool, getAttachmentUrlTool, deleteAttachmentTool,
  requestAttachmentUploadTool, confirmAttachmentUploadTool,
} from "./tools/attachments";
// Time
import {
  startDemandTimerTool, stopDemandTimerTool, getActiveTimerTool,
  listTimeEntriesTool, logTimeEntryTool,
} from "./tools/time";
// Services
import {
  listServicesTool, getServiceTool, createServiceTool, updateServiceTool, deleteServiceTool,
} from "./tools/services";
// Notes
import {
  listNotesTool, getNoteTool, createNoteTool, updateNoteTool, archiveNoteTool,
} from "./tools/notes";
// Projects
import {
  listProjectsTool, getProjectTool, createProjectTool, linkDemandToProjectTool,
} from "./tools/projects";
// Requests
import {
  listDemandRequestsTool, getDemandRequestTool, createDemandRequestTool, respondToRequestTool,
} from "./tools/requests";
// Templates
import {
  listTemplatesTool, getTemplateTool, createTemplateTool, updateTemplateTool, deleteTemplateTool,
} from "./tools/templates";
// Recurring
import {
  listRecurringDemandsTool, getRecurringDemandTool, createRecurringDemandTool,
  updateRecurringDemandTool, pauseRecurringTool, resumeRecurringTool, deleteRecurringTool,
} from "./tools/recurring";
// Notifications
import {
  listNotificationsTool, markNotificationReadTool, markAllReadTool,
  getNotificationPreferencesTool, updateNotificationPreferencesTool,
} from "./tools/notifications";
// Sharing
import {
  createDemandShareTokenTool, listDemandShareTokensTool, revokeDemandShareTokenTool,
} from "./tools/sharing";
// Analytics
import {
  boardSummaryStatsTool, overdueDemandsTool, dueSoonDemandsTool,
  getOperationalSnapshotTool, riskOfDelayTool, userProductivityStatsTool,
} from "./tools/analytics";
// Meta
import { pingTool, getServerVersionTool, listCapabilitiesTool } from "./tools/meta";

// OAuth issuer MUST be the direct Supabase host, not the Lovable Cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA+ — Operações (Marketing OS)",
  version: "2.0.0",
  instructions: [
    "Servidor MCP do SoMA+, o pilar **O — Operações** da suíte Marketing OS (método AEIOU).",
    "Toda chamada respeita a identidade do usuário conectado e as políticas RLS do Supabase.",
    "",
    "## Envelope de resposta",
    "Todas as tools devolvem `structuredContent` com:",
    "  - `source: \"soma\"`",
    "  - `generated_at` (ISO-8601)",
    "  - `open_url` — link canônico para abrir o recurso no SoMA+ (quando aplicável)",
    "  - `warnings[]` — avisos não fatais",
    "  - payload específico da tool",
    "",
    "## Códigos de erro (`isError: true` + `error_code`)",
    "PERMISSION_DENIED · NOT_FOUND · VALIDATION · PLAN_LIMIT · DB_ERROR · AUTH_EXPIRED · TIMEOUT · PARTIAL_RESULT · UNSUPPORTED",
    "Cada erro traz `user_message` (pt-BR) e `recovery_options[]`.",
    "",
    "## Fluxo canônico",
    "1. `whoami` — confirma identidade.",
    "2. `list_my_teams` — escolhe `team_id`.",
    "3. `list_boards` — escolhe `board_id`.",
    "4. `list_board_statuses` + `list_board_members` + `list_board_services` — carrega catálogo.",
    "5. `get_operational_snapshot` para leitura executiva, ou operar demandas.",
    "",
    "## Tools por intenção (§21.1 do descritivo SoMA+)",
    "- **Consultar operação:** `get_operational_snapshot`, `board_summary_stats`, `overdue_demands`, `due_soon_demands`, `risk_of_delay`.",
    "- **Criar quadro:** `list_boards`, `create_board`, `add_board_member`, `attach_service_to_board`.",
    "- **Criar demanda:** `list_board_statuses`, `list_board_services`, `list_board_members`, `create_demand`, `create_demand_with_subdemands`.",
    "- **Trabalhar em demanda:** `get_demand`, `move_demand`, `post_comment`, `start_demand_timer`, `stop_demand_timer`.",
    "- **Solicitação/aprovação:** `list_demand_requests`, `create_demand_request`, `respond_to_request`.",
    "- **Recorrência/template:** `list_recurring_demands`, `create_recurring_demand`, `list_templates`, `create_template`.",
    "- **Compartilhar:** `create_demand_share_token`, `revoke_demand_share_token`.",
    "- **Notificações:** `list_notifications`, `mark_all_read`, `get_notification_preferences`, `update_notification_preferences`.",
    "",
    "## Confirmação",
    "Use as `annotations`: `readOnlyHint`, `destructiveHint`, `idempotentHint`. Confirme antes de destrutivas ou lote.",
    "",
    "Documentação completa: /mcp-docs no SoMA+.",
  ].join("\n"),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    // session
    whoamiTool, getProfileTool, updateProfileTool,
    // teams
    listMyTeamsTool, getTeamTool, listTeamMembersTool, listTeamPositionsTool, joinTeamWithCodeTool, getPlanLimitsTool,
    // boards
    listBoardsTool, getBoardTool, createBoardTool, updateBoardTool, archiveBoardTool,
    listBoardMembersTool, addBoardMemberTool, updateBoardMemberRoleTool, removeBoardMemberTool,
    listBoardStatusesTool, listBoardServicesTool, attachServiceToBoardTool,
    // demands
    listDemandsTool, searchDemandsTool, getDemandTool, createDemandTool, updateDemandTool,
    moveDemandTool, assignDemandTool, addFollowerTool, removeFollowerTool, addDependencyTool,
    archiveDemandTool, deleteDemandTool, createDemandWithSubdemandsTool,
    // subtasks
    listSubtasksTool, createSubtaskTool, toggleSubtaskTool, updateSubtaskTool, deleteSubtaskTool,
    // comments
    listCommentsTool, postCommentTool, deleteCommentTool,
    // attachments
    listAttachmentsTool, getAttachmentUrlTool, deleteAttachmentTool, requestAttachmentUploadTool, confirmAttachmentUploadTool,
    // time
    startDemandTimerTool, stopDemandTimerTool, getActiveTimerTool, listTimeEntriesTool, logTimeEntryTool,
    // services
    listServicesTool, getServiceTool, createServiceTool, updateServiceTool, deleteServiceTool,
    // notes
    listNotesTool, getNoteTool, createNoteTool, updateNoteTool, archiveNoteTool,
    // projects
    listProjectsTool, getProjectTool, createProjectTool, linkDemandToProjectTool,
    // requests
    listDemandRequestsTool, getDemandRequestTool, createDemandRequestTool, respondToRequestTool,
    // templates
    listTemplatesTool, getTemplateTool, createTemplateTool, updateTemplateTool, deleteTemplateTool,
    // recurring
    listRecurringDemandsTool, getRecurringDemandTool, createRecurringDemandTool, updateRecurringDemandTool,
    pauseRecurringTool, resumeRecurringTool, deleteRecurringTool,
    // notifications
    listNotificationsTool, markNotificationReadTool, markAllReadTool,
    getNotificationPreferencesTool, updateNotificationPreferencesTool,
    // sharing
    createDemandShareTokenTool, listDemandShareTokensTool, revokeDemandShareTokenTool,
    // analytics
    boardSummaryStatsTool, overdueDemandsTool, dueSoonDemandsTool,
    getOperationalSnapshotTool, riskOfDelayTool, userProductivityStatsTool,
    // meta
    pingTool, getServerVersionTool, listCapabilitiesTool,
  ],
});
