import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listBoardsTool from "./tools/list-boards";
import listMyDemandsTool from "./tools/list-my-demands";
import searchDemandsTool from "./tools/search-demands";
import getDemandTool from "./tools/get-demand";

// The OAuth issuer must be the direct Supabase host, derived from the project
// ref (a build-time literal), never from SUPABASE_URL which can be a proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA — Gestão de Demandas",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura para a plataforma SoMA (quadros, demandas e perfil do usuário). " +
    "Todas as chamadas respeitam as permissões (RLS) do usuário autenticado. " +
    "Use `whoami` para confirmar a sessão, `list_boards` para descobrir quadros, " +
    "`list_my_demands` para ver as demandas do usuário, `search_demands` para busca por texto, " +
    "e `get_demand` para detalhes de uma demanda específica.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listBoardsTool, listMyDemandsTool, searchDemandsTool, getDemandTool],
});
