import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { whoamiTool } from "./tools/session";
import { listMyTeamsTool, listTeamMembersTool } from "./tools/teams";
import { listBoardsTool } from "./tools/boards";
import {
  listDemandsTool,
  getDemandTool,
  createDemandTool,
  updateDemandStatusTool,
  listBoardStatusesTool,
} from "./tools/demands";

// The OAuth issuer MUST be the direct Supabase host (build-time literal),
// never SUPABASE_URL (which is proxied on Lovable Cloud).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA — Operações (Marketing OS)",
  version: "1.0.0",
  instructions: [
    "Servidor MCP do SoMA, app de Operações da suíte Marketing OS.",
    "Todas as chamadas respeitam a autenticação e o RLS do usuário conectado.",
    "",
    "Fluxo recomendado:",
    "1. `whoami` — confirma identidade.",
    "2. `list_my_teams` — escolha um team_id.",
    "3. `list_boards` com o team_id — escolha um board_id.",
    "4. `list_board_statuses` + `list_demands` para operar no board.",
    "",
    "Erros: PERMISSION_DENIED, NOT_FOUND, PLAN_LIMIT_*, DB_ERROR.",
  ].join("\n"),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listMyTeamsTool,
    listTeamMembersTool,
    listBoardsTool,
    listBoardStatusesTool,
    listDemandsTool,
    getDemandTool,
    createDemandTool,
    updateDemandStatusTool,
  ],
});
