import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { whoamiTool } from "./tools/whoami";

// The OAuth issuer MUST be the direct Supabase host (a build-time literal),
// never SUPABASE_URL (which is proxied on Lovable Cloud).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "soma-mcp",
  title: "SoMA — Operações (Marketing OS)",
  version: "2.0.0",
  instructions: [
    "Servidor MCP do SoMA (reset mínimo).",
    "Somente a ferramenta `whoami` está disponível — use-a para validar a conexão OAuth.",
    "As demais ferramentas serão restauradas após validar a conexão.",
  ].join("\n"),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool],
});
