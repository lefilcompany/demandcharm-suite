import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EndpointCard, type ManifestTool } from "@/components/mcp-docs/EndpointCard";
import { TryItLoginPanel } from "@/components/mcp-docs/TryItLoginPanel";
import { Search, ShieldCheck, Zap, BookOpen, ArrowRight } from "lucide-react";
import manifestJson from "../../.lovable/mcp/manifest.json";

// Toggle to reveal the real MCP endpoint URL in the UI and examples.
// Keep `false` for public docs; flip to `true` when ready to expose it.
const SHOW_ENDPOINT = false;

interface Manifest {
  version: number;
  path?: string;
  mcp?: {
    server?: { name?: string; version?: string; title?: string };
    tools?: ManifestTool[];
  };
}

const DOMAINS: Array<{ id: string; label: string; match: (n: string) => boolean }> = [
  { id: "session", label: "Sessão & Perfil", match: n => ["whoami", "get_profile", "update_profile"].includes(n) },
  { id: "teams", label: "Times", match: n => (n.includes("team") && !n.includes("template")) || n === "get_plan_limits" || n === "join_team_with_code" },
  { id: "boards", label: "Quadros", match: n => n.includes("board") && !n.includes("dashboard") },
  { id: "demands", label: "Demandas", match: n => (n.endsWith("_demand") || n.endsWith("_demands") || n === "search_demands" || n === "assign_demand" || n === "add_follower" || n === "remove_follower" || n === "add_dependency" || n === "create_demand_with_subdemands" || n === "move_demand") && !n.includes("recurring") && !n.includes("request") && !n.includes("share") && !n.includes("overdue") && !n.includes("due_soon") },
  { id: "subtasks", label: "Subtarefas", match: n => n.includes("subtask") },
  { id: "comments", label: "Comentários", match: n => n.includes("comment") },
  { id: "attachments", label: "Anexos", match: n => n.includes("attachment") },
  { id: "time", label: "Tempo", match: n => n.includes("timer") || n.includes("time_entr") },
  { id: "services", label: "Serviços", match: n => ["list_services", "get_service", "create_service", "update_service", "delete_service"].includes(n) },
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
  return DOMAINS.find(d => d.match(name)) ?? { id: "other", label: "Outros", match: () => false };
}

const ERROR_CODES = [
  { code: "PERMISSION_DENIED", desc: "Usuário sem permissão para o recurso ou ação." },
  { code: "NOT_FOUND", desc: "Recurso inexistente ou fora do escopo do usuário." },
  { code: "VALIDATION", desc: "Parâmetros inválidos (tipo, formato ou obrigatoriedade)." },
  { code: "PLAN_LIMIT", desc: "Limite do plano atingido (demandas, quadros, membros…)." },
  { code: "DB_ERROR", desc: "Falha na camada de dados; tente novamente." },
  { code: "AUTH_EXPIRED", desc: "Token OAuth expirado — refaça o refresh." },
  { code: "TIMEOUT", desc: "Operação excedeu o tempo limite." },
  { code: "PARTIAL_RESULT", desc: "Resposta parcial; consulte `warnings`." },
  { code: "UNSUPPORTED", desc: "Ação não suportada nesta versão do MCP." },
];

export default function McpDocs() {
  const [manifest, setManifest] = useState<Manifest | null>(manifestJson as Manifest);
  const [query, setQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  useEffect(() => {
    document.title = "MCP SoMA+ — API de Operações Marketing OS";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Documentação interativa do MCP SoMA+: endpoints, exemplos e Try-it. Integração com Marketing OS Orchestrator via OAuth 2.1.");
    // Fallback: try to fetch a fresher manifest at runtime (published build).
    fetch("/.lovable/mcp/manifest.json")
      .then(r => (r.ok ? r.json() : null))
      .then(m => { if (m && m.mcp?.tools?.length) setManifest(m); })
      .catch(() => { /* keep bundled manifest */ });
  }, []);

  const tools = manifest?.mcp?.tools ?? [];
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "erxhxmetrvkigjwxchbj";
  const endpointReal = `https://${projectRef}.supabase.co/functions/v1/mcp`;
  const endpointMasked = "https://•••••••••••••.supabase.co/functions/v1/mcp";
  const endpointDisplay = SHOW_ENDPOINT ? endpointReal : endpointMasked;

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
      const label = domainOf(t.name).label;
      const arr = map.get(label) ?? [];
      arr.push(t);
      map.set(label, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F28705] text-white grid place-items-center font-bold shadow-sm">S+</div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-tight">MCP SoMA+ — API de Operações Marketing OS</h1>
            <p className="text-xs text-muted-foreground">
              {manifest?.mcp?.server?.title ?? "SoMA+ MCP"} · v{manifest?.mcp?.server?.version ?? "2.0.0"} · {tools.length} endpoints
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> OAuth 2.1 + PKCE</Badge>
            <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3" /> MCP 2025-06-18</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-1 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar endpoint…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <button
            onClick={() => setSelectedDomain(null)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${!selectedDomain ? "bg-[#F28705] text-white font-medium" : "hover:bg-muted"}`}
          >
            Todos <span className="opacity-60 text-xs">({tools.length})</span>
          </button>
          {DOMAINS.map(d => {
            const count = tools.filter(t => d.match(t.name)).length;
            if (!count) return null;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDomain(d.id)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${selectedDomain === d.id ? "bg-[#F28705] text-white font-medium" : "hover:bg-muted"}`}
              >
                {d.label} <span className="opacity-60 text-xs">({count})</span>
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <section className="min-w-0 space-y-6">
          {/* Overview */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-start gap-3 mb-3">
              <BookOpen className="w-5 h-5 text-[#F28705] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold">Visão geral</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  O <strong>MCP SoMA+</strong> expõe as operações do SoMA (equipes, quadros, demandas, tempo, notas, analytics)
                  como ferramentas MCP consumíveis pelo <strong>Marketing OS Orchestrator</strong>. Cada chamada respeita a
                  identidade do usuário conectado, o modelo de <em>time → quadro → demanda</em> e as políticas de RLS.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="p-3 rounded-lg border bg-background">
                <div className="text-muted-foreground mb-1">Endpoint MCP</div>
                <code className="text-[11px] break-all">{endpointDisplay}</code>
                {!SHOW_ENDPOINT && <p className="text-[10px] text-muted-foreground mt-1">Disponível após conexão via Orchestrator.</p>}
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <div className="text-muted-foreground mb-1">Autenticação</div>
                <div>OAuth 2.1 + PKCE + DCR</div>
                <div className="text-muted-foreground text-[11px]">Escopo padrão: <code>openid email profile</code></div>
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <div className="text-muted-foreground mb-1">Fluxo recomendado</div>
                <div className="text-[11px]">
                  whoami <ArrowRight className="w-3 h-3 inline" /> list_my_teams <ArrowRight className="w-3 h-3 inline" /> list_boards <ArrowRight className="w-3 h-3 inline" /> operar
                </div>
              </div>
            </div>
          </div>

          {/* Login para teste */}
          <TryItLoginPanel />

          {/* Envelope + Errors */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-2">Envelope de resposta</h3>
              <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto"><code>{`{
  "source": "soma",
  "generated_at": "2026-07-17T14:16:00Z",
  "open_url": "https://pla.soma.lefil.com.br/…",
  "warnings": [],
  "result": { /* payload do domínio */ }
}`}</code></pre>
              <p className="text-[11px] text-muted-foreground mt-2">
                Erros: <code>isError: true</code> + <code>error_code</code> + <code>recovery_options[]</code>.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-2">Códigos de erro</h3>
              <div className="space-y-1 text-[11px]">
                {ERROR_CODES.map(e => (
                  <div key={e.code} className="flex gap-2">
                    <code className="text-destructive font-semibold w-32 shrink-0">{e.code}</code>
                    <span className="text-muted-foreground">{e.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="space-y-6">
            {grouped.length === 0 && (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
                {manifest ? "Nenhum endpoint corresponde ao filtro." : "Carregando manifest…"}
              </div>
            )}
            {grouped.map(([label, items]) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#F28705]">{label}</h2>
                  <span className="text-[11px] text-muted-foreground">({items.length})</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-2">
                  {items.map(t => (
                    <EndpointCard
                      key={t.name}
                      tool={t}
                      endpointReal={endpointReal}
                      endpointDisplay={endpointDisplay}
                      showEndpoint={SHOW_ENDPOINT}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <footer className="text-center text-xs text-muted-foreground py-8 border-t">
            MCP SoMA+ · Marketing OS · {new Date().getFullYear()}
          </footer>
        </section>
      </main>
    </div>
  );
}
