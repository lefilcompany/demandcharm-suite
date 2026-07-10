import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import manifest from "../../.lovable/mcp/manifest.json";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Search, Shield, Zap, AlertTriangle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ToolManifest = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
};

const DOMAIN_ORDER: { key: string; label: string; match: (name: string) => boolean }[] = [
  { key: "session", label: "Sessão & Perfil", match: (n) => ["whoami", "get_user_profile", "update_my_profile"].includes(n) },
  { key: "teams", label: "Times", match: (n) => n.includes("team") || n === "get_plan_limits" || n === "join_team_with_code" },
  { key: "boards", label: "Quadros", match: (n) => n.includes("board") && !n.includes("summary") },
  { key: "demands", label: "Demandas", match: (n) => (n.includes("demand") || n.includes("subdemand") || n.includes("dependency") || n.includes("assignee")) && !n.includes("request") && !n.includes("subtask") && !n.includes("comment") && !n.includes("attachment") && !n.includes("time_") && !n.includes("share") },
  { key: "subtasks", label: "Subtarefas", match: (n) => n.includes("subtask") },
  { key: "comments", label: "Comentários", match: (n) => n.includes("comment") && !n.includes("request") },
  { key: "attachments", label: "Anexos", match: (n) => n.includes("attachment") },
  { key: "time", label: "Time tracking", match: (n) => n.includes("timer") || n.includes("time_entr") || n === "manual_time_entry" },
  { key: "services", label: "Serviços", match: (n) => n.endsWith("_service") || n === "list_services" || n === "get_service" },
  { key: "notes", label: "Notas", match: (n) => n.includes("note") },
  { key: "projects", label: "Projetos/Pastas", match: (n) => n.includes("project") },
  { key: "requests", label: "Solicitações", match: (n) => n.includes("request") },
  { key: "templates", label: "Templates & Recorrentes", match: (n) => n.includes("template") || n.includes("recurring") },
  { key: "notifications", label: "Notificações", match: (n) => n.includes("notification") },
  { key: "sharing", label: "Compartilhamento", match: (n) => n.includes("share_token") },
  { key: "analytics", label: "Analytics & Relatórios", match: (n) => ["board_summary_stats", "demands_by_period", "overdue_demands", "user_productivity_stats"].includes(n) },
];

function permBadge(t: ToolManifest) {
  const a = t.annotations ?? {};
  if (a.destructiveHint) return { label: "destrutivo", cls: "bg-red-500/10 text-red-500 border-red-500/30", icon: AlertTriangle };
  if (a.readOnlyHint) return { label: "leitura", cls: "bg-green-500/10 text-green-600 border-green-500/30", icon: BookOpen };
  return { label: "escrita", cls: "bg-[#F28705]/10 text-[#F28705] border-[#F28705]/30", icon: Zap };
}

export default function McpDocs() {
  const [q, setQ] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const tools = (manifest as unknown as { mcp: { tools: ToolManifest[] } }).mcp.tools;
  const server = (manifest as unknown as { mcp: { server: { name: string; title: string; version: string } }; auth?: { issuer?: string } }).mcp.server;

  const grouped = useMemo(() => {
    const map = new Map<string, ToolManifest[]>();
    for (const d of DOMAIN_ORDER) map.set(d.key, []);
    for (const t of tools) {
      const d = DOMAIN_ORDER.find((x) => x.match(t.name));
      if (d) map.get(d.key)!.push(t);
    }
    return map;
  }, [tools]);

  const filteredTools = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle && !selectedDomain) return tools;
    return tools.filter((t) => {
      if (selectedDomain) {
        const d = DOMAIN_ORDER.find((x) => x.key === selectedDomain);
        if (!d?.match(t.name)) return false;
      }
      if (!needle) return true;
      return t.name.includes(needle) || (t.title ?? "").toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle);
    });
  }, [tools, q, selectedDomain]);

  const endpoint = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>API MCP do SoMA — Documentação</title>
        <meta name="description" content="Documentação completa da API MCP do SoMA: 97 ferramentas de leitura e escrita para integração com assistentes de IA." />
      </Helmet>

      <header className="border-b bg-gradient-to-r from-[#F28705]/10 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#F28705] flex items-center justify-center text-white font-bold">S+</div>
            <div>
              <h1 className="text-3xl font-bold">API MCP do SoMA</h1>
              <p className="text-muted-foreground text-sm">{server.title} · v{server.version} · {tools.length} ferramentas</p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-3xl mt-4">
            Conecte assistentes de IA (Claude, ChatGPT, Cursor, Codex) ao SoMA para executar demandas, quadros,
            comentários, tempo e mais — tudo respeitando as permissões do usuário conectado via OAuth.
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Endpoint MCP</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block text-xs bg-muted p-2 rounded break-all">{endpoint}</code>
              <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("URL copiada"); }}>
                <Copy className="w-3 h-3 mr-2" /> Copiar
              </Button>
            </CardContent>
          </Card>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Domínios</div>
            <button
              onClick={() => setSelectedDomain(null)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition ${!selectedDomain ? "bg-muted font-medium" : ""}`}
            >Todos ({tools.length})</button>
            {DOMAIN_ORDER.map((d) => {
              const n = grouped.get(d.key)?.length ?? 0;
              if (!n) return null;
              return (
                <button key={d.key}
                  onClick={() => setSelectedDomain(d.key)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted transition ${selectedDomain === d.key ? "bg-muted font-medium text-[#F28705]" : ""}`}
                >{d.label} <span className="text-xs text-muted-foreground">({n})</span></button>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          <section className="mb-8">
            <Card>
              <CardHeader><CardTitle>Como conectar</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ol className="list-decimal ml-4 space-y-2">
                  <li>No seu cliente MCP (Claude Desktop, ChatGPT, Cursor…), adicione um servidor MCP HTTP com a URL acima.</li>
                  <li>O cliente redireciona para o SoMA para você aprovar o acesso via OAuth 2.1.</li>
                  <li>Após aprovar, todas as ferramentas ficam disponíveis — cada chamada opera como você, respeitando permissões de time e quadro.</li>
                </ol>
                <div className="pt-2">
                  <strong>Autenticação:</strong> OAuth 2.1 com Dynamic Client Registration via Supabase Auth. Nenhum token é armazenado no cliente MCP.
                </div>
                <div>
                  <strong>Erros padronizados:</strong>{" "}
                  <code className="text-xs">PERMISSION_DENIED</code>,{" "}
                  <code className="text-xs">NOT_FOUND</code>,{" "}
                  <code className="text-xs">VALIDATION</code>,{" "}
                  <code className="text-xs">PLAN_LIMIT_*</code>,{" "}
                  <code className="text-xs">DB_ERROR</code>.
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ferramentas por nome ou descrição…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="max-h-none">
            <div className="space-y-3">
              {filteredTools.map((t) => {
                const perm = permBadge(t);
                const Icon = perm.icon;
                const props = (t.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] })?.properties ?? {};
                const required = new Set((t.inputSchema as { required?: string[] })?.required ?? []);
                return (
                  <Card key={t.name}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="font-mono text-sm break-all">{t.name}</CardTitle>
                          <div className="text-xs text-muted-foreground mt-0.5">{t.title}</div>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ${perm.cls}`}>
                          <Icon className="w-3 h-3 mr-1" />{perm.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{t.description}</p>
                      {Object.keys(props).length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Parâmetros</div>
                          <div className="rounded-md border divide-y">
                            {Object.entries(props).map(([name, prop]) => (
                              <div key={name} className="p-2 flex items-start gap-3 text-xs">
                                <code className="font-mono text-[#F28705]">{name}{required.has(name) ? "*" : ""}</code>
                                <span className="text-muted-foreground shrink-0">{prop.type ?? "any"}</span>
                                <span className="min-w-0 flex-1">{prop.description ?? ""}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filteredTools.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">Nenhuma ferramenta encontrada</div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
