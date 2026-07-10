import { auth, defineMcp } from "@lovable.dev/mcp-js";
import * as session from "./tools/session";
import * as teams from "./tools/teams";
import * as boards from "./tools/boards";
import * as demands from "./tools/demands";
import * as subtasks from "./tools/subtasks";
import * as comments from "./tools/comments";
import * as attachments from "./tools/attachments";
import * as time from "./tools/time";
import * as services from "./tools/services";
import * as notes from "./tools/notes";
import * as projects from "./tools/projects";
import * as requests from "./tools/requests";
import * as templates from "./tools/templates";
import * as notifications from "./tools/notifications";
import * as sharing from "./tools/sharing";
import * as analytics from "./tools/analytics";

// The OAuth issuer MUST be the direct Supabase host (a build-time literal),
// never SUPABASE_URL (which is proxied on Lovable Cloud).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

const allTools = [
  ...Object.values(session),
  ...Object.values(teams),
  ...Object.values(boards),
  ...Object.values(demands),
  ...Object.values(subtasks),
  ...Object.values(comments),
  ...Object.values(attachments),
  ...Object.values(time),
  ...Object.values(services),
  ...Object.values(notes),
  ...Object.values(projects),
  ...Object.values(requests),
  ...Object.values(templates),
  ...Object.values(notifications),
  ...Object.values(sharing),
  ...Object.values(analytics),
];

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA — API completa (demandas, quadros, times, tempo)",
  version: "1.0.0",
  instructions: [
    "API MCP completa da plataforma SoMA. Todas as chamadas respeitam a autenticação e as regras de acesso (RLS) do usuário conectado — cada ferramenta atua como se o próprio usuário estivesse operando o app.",
    "",
    "Domínios cobertos:",
    "• Sessão/Perfil: whoami, get_user_profile, update_my_profile",
    "• Times: list_my_teams, get_team, list_team_members, join_team_with_code, get_plan_limits",
    "• Quadros: CRUD completo, membros, status e serviços",
    "• Demandas: listagem/busca/criação/edição/status/atribuições/dependências/subdemandas",
    "• Subtarefas (checklist), Comentários (canal general/internal), Anexos",
    "• Tempo: start/stop timer, entradas manuais, relatórios",
    "• Serviços, Notas (+compartilhamento), Projetos/Pastas",
    "• Solicitações (aprovar/rejeitar/devolver)",
    "• Templates e Recorrentes",
    "• Notificações, Compartilhamento por link",
    "• Analytics: sumários, atrasadas, produtividade",
    "",
    "Convenções de erro: PERMISSION_DENIED, NOT_FOUND, VALIDATION, PLAN_LIMIT_*, DB_ERROR.",
    "Ferramentas destrutivas são marcadas com destructiveHint=true.",
  ].join("\n"),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: allTools,
});
