import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listBoardsTool from "./tools/list-boards";
import listMyDemandsTool from "./tools/list-my-demands";
import searchDemandsTool from "./tools/search-demands";
import getDemandTool from "./tools/get-demand";
import createDemandTool from "./tools/create-demand";

// The OAuth issuer must be the direct Supabase host, derived from the project
// ref (a build-time literal), never from SUPABASE_URL which can be a proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA — Gestão de Demandas",
  version: "0.1.0",
  instructions:
    "Ferramentas para a plataforma SoMA (quadros e demandas). Todas as chamadas respeitam as " +
    "permissões (RLS) do usuário autenticado. Leitura: `whoami` (sessão), `list_boards` " +
    "(quadros), `list_my_demands` (demandas do usuário), `search_demands` (busca por texto) e " +
    "`get_demand` (detalhes). Escrita: `create_demand` cria uma nova demanda em um quadro, " +
    "assumindo o usuário autenticado como responsável quando `assignee_user_id` não é informado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listBoardsTool,
    listMyDemandsTool,
    searchDemandsTool,
    getDemandTool,
    createDemandTool,
  ],
});
