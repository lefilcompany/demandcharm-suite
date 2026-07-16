import { auth, defineMcp } from "@lovable.dev/mcp-js";
import * as session from "./tools/session";
import * as teams from "./tools/teams";
import * as boards from "./tools/boards";
import * as demands from "./tools/demands";
import * as subtasks from "./tools/subtasks";
import * as comments from "./tools/comments";
import * as attachments from "./tools/attachments";
import * as projects from "./tools/projects";
import * as requests from "./tools/requests";
import * as notifications from "./tools/notifications";

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
  ...Object.values(projects),
  ...Object.values(requests),
  ...Object.values(notifications),
];

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA — Operações (Marketing OS)",
  version: "1.1.0",
  instructions: [
    "Servidor MCP do SoMA, o app de Operações da suíte Marketing OS (pilar O do método AEIOU).",
    "Expõe projetos, tarefas (demandas), responsáveis, datas, status, dependências, subtarefas, anexos, comentários e aprovações. Todas as chamadas respeitam a autenticação e o RLS do usuário conectado — cada tool atua como se o próprio usuário estivesse operando o app.",
    "",
    "Fluxo recomendado após autenticação:",
    "1. `whoami` — confirma identidade do usuário conectado.",
    "2. `list_my_teams` — lista as equipes que o usuário participa; peça ao usuário para escolher qual equipe usar e memorize `team_id`.",
    "3. `list_boards` com o `team_id` escolhido — lista os quadros; peça ao usuário para escolher o quadro ativo e memorize `board_id`.",
    "4. A partir daí, use `board_id` (e opcionalmente `team_id`) nas chamadas de demandas, projetos, solicitações e afins.",
    "",
    "Domínios cobertos:",
    "• Sessão/Perfil: whoami, get_user_profile, update_my_profile",
    "• Times: list_my_teams, get_team, list_team_members, list_team_positions, join_team_with_code, get_plan_limits",
    "• Quadros: listar/criar/editar/arquivar/excluir, membros, status",
    "• Demandas: listar/buscar/criar/editar/mudar status/mover/atribuir/dependências/subdemandas",
    "• Subtarefas (checklist), Comentários (canal general/internal), Anexos",
    "• Projetos (pastas) e vínculo demanda↔projeto",
    "• Solicitações (aprovar/rejeitar/devolver/comentar)",
    "• Notificações",
    "",
    "Convenções de erro: PERMISSION_DENIED, NOT_FOUND, VALIDATION, PLAN_LIMIT_*, DB_ERROR.",
    "Ferramentas destrutivas são marcadas com destructiveHint=true e devem ser confirmadas com o usuário antes da execução.",
  ].join("\n"),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: allTools,
});
