import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ManifestTool {
  name: string;
  title?: string;
  description?: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  inputSchema?: any;
}

interface Manifest {
  version: number;
  sdk_version?: string;
  path?: string;
  mcp?: {
    server?: { name?: string; version?: string; title?: string };
    tools?: ManifestTool[];
  };
}

// Group prefixes → domain label (based on the tool name prefix).
const DOMAINS: Array<{ id: string; label: string; match: (n: string) => boolean }> = [
  { id: "session", label: "Sessão & Perfil", match: n => ["whoami", "get_profile", "update_profile"].includes(n) },
  { id: "teams", label: "Times", match: n => n.includes("team") || n === "get_plan_limits" },
  { id: "boards", label: "Quadros", match: n => n.includes("board") },
  { id: "demands", label: "Demandas", match: n => n.startsWith("list_demands") || n.startsWith("search_demands") || n === "get_demand" || n === "create_demand" || n === "update_demand" || n === "move_demand" || n === "assign_demand" || n === "add_follower" || n === "remove_follower" || n === "add_dependency" || n === "archive_demand" || n === "delete_demand" || n === "create_demand_with_subdemands" },
  { id: "subtasks", label: "Subtarefas", match: n => n.includes("subtask") },
  { id: "comments", label: "Comentários", match: n => n.includes("comment") },
  { id: "attachments", label: "Anexos", match: n => n.includes("attachment") },
  { id: "time", label: "Tempo", match: n => n.includes("timer") || n.includes("time_entr") },
  { id: "services", label: "Serviços", match: n => n === "list_services" || n === "get_service" || n === "create_service" || n === "update_service" || n === "delete_service" },
  { id: "notes", label: "Notas", match: n => n.includes("note") && !n.includes("notification") },
  { id: "projects", label: "Projetos/Pastas", match: n => n.includes("project") },
  { id: "requests", label: "Solicitações", match: n => n.includes("request") },
  { id: "templates", label: "Templates", match: n => n.includes("template") },
  { id: "recurring", label: "Recorrências", match: n => n.includes("recurring") },
  { id: "notifications", label: "Notificações", match: n => n.includes("notification") },
  { id: "sharing", label: "Compartilhamento", match: n => n.includes("share") },
  { id: "analytics", label: "Analytics", match: n => ["board_summary_stats", "overdue_demands", "due_soon_demands", "get_operational_snapshot", "risk_of_delay", "user_productivity_stats"].includes(n) },
  { id: "meta", label: "Meta", match: n => ["ping", "get_server_version", "list_capabilities"].includes(n) },
];

function domainOf(name: string) {
  return DOMAINS.find(d => d.match(name)) ?? { id: "other", label: "Outros" };
}

export default function McpDocs() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [query, setQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  useEffect(() => {
    document.title = "MCP SoMA+ — Documentação de Endpoints";
    fetch("/.lovable/mcp/manifest.json").then(r => r.json()).then(setManifest).catch(() => setManifest(null));
  }, []);

  const tools = manifest?.mcp?.tools ?? [];
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "erxhxmetrvkigjwxchbj";
  const endpoint = `https://${projectRef}.supabase.co/functions/v1/mcp`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter(t => {
      if (selectedDomain && domainOf(t.name).id !== selectedDomain) return false;
      if (!q) return true;
      return (t.name + " " + (t.title ?? "") + " " + (t.description ?? "")).toLowerCase().includes(q);
    });
  }, [tools, query, selectedDomain]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManifestTool[]>();
    for (const t of filtered) {
      const d = domainOf(t.name).label;
      const arr = map.get(d) ?? [];
      arr.push(t);
      map.set(d, arr);
    }
    return [...map.entries()].sort();
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#F28705] text-white grid place-items-center font-bold">S+</div>
            <div>
              <h1 className="text-2xl font-semibold">MCP SoMA+ — Documentação</h1>
              <p className="text-sm text-muted-foreground">Servidor MCP de operações · Marketing OS (AEIOU)</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <div className="p-3 rounded-lg border bg-background">
              <div className="text-xs text-muted-foreground">Endpoint</div>
              <code className="text-xs break-all">{endpoint}</code>
            </div>
            <div className="p-3 rounded-lg border bg-background">
              <div className="text-xs text-muted-foreground">Servidor</div>
              <div>{manifest?.mcp?.server?.title ?? "SoMA+ MCP"} · v{manifest?.mcp?.server?.version ?? "2.0.0"}</div>
            </div>
            <div className="p-3 rounded-lg border bg-background">
              <div className="text-xs text-muted-foreground">Tools</div>
              <div>{tools.length} disponíveis</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <button
            onClick={() => setSelectedDomain(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm ${!selectedDomain ? "bg-[#F28705] text-white" : "hover:bg-muted"}`}
          >Todos ({tools.length})</button>
          {DOMAINS.map(d => {
            const count = tools.filter(t => d.match(t.name)).length;
            if (!count) return null;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDomain(d.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedDomain === d.id ? "bg-[#F28705] text-white" : "hover:bg-muted"}`}
              >
                {d.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </aside>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Input placeholder="Buscar por nome, descrição…" value={query} onChange={e => setQuery(e.target.value)} className="max-w-md" />
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
          </div>

          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="font-semibold mb-2">Envelope padrão de resposta</div>
            <pre className="text-xs overflow-x-auto bg-muted p-3 rounded"><code>{`{
  "source": "soma",
  "generated_at": "2026-07-17T14:16:00Z",
  "open_url": "https://pla.soma.lefil.com.br/demands/…",
  "warnings": [],
  ...payload
}`}</code></pre>
            <div className="mt-3 text-xs text-muted-foreground">
              Erros retornam <code>isError: true</code> + <code>error_code</code> ∈ &#123;PERMISSION_DENIED, NOT_FOUND, VALIDATION, PLAN_LIMIT, DB_ERROR, AUTH_EXPIRED, TIMEOUT, PARTIAL_RESULT, UNSUPPORTED&#125; e <code>recovery_options[]</code>.
            </div>
          </div>

          <ScrollArea className="max-h-[calc(100vh-320px)]">
            {grouped.map(([label, items]) => (
              <div key={label} className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                  {label}
                </h2>
                <div className="grid gap-3">
                  {items.map(t => (
                    <Card key={t.name}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <code className="text-sm">{t.name}</code>
                          <span className="text-muted-foreground font-normal">— {t.title}</span>
                        </CardTitle>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.annotations?.readOnlyHint && <Badge variant="secondary">read-only</Badge>}
                          {t.annotations?.destructiveHint && <Badge variant="destructive">destructive</Badge>}
                          {t.annotations?.idempotentHint && <Badge variant="outline">idempotent</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {t.description && <p className="text-sm text-muted-foreground mb-2">{t.description}</p>}
                        {t.inputSchema && Object.keys(t.inputSchema?.properties ?? {}).length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver schema de entrada</summary>
                            <pre className="mt-2 bg-muted p-3 rounded overflow-x-auto"><code>{JSON.stringify(t.inputSchema, null, 2)}</code></pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {manifest ? "Nenhuma ferramenta corresponde ao filtro." : "Carregando manifest…"}
              </div>
            )}
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}
