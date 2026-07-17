import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SchemaField } from "./SchemaField";
import { exampleFromSchema } from "@/lib/mcp-docs/exampleFromSchema";
import { toast } from "sonner";
import { Play, ShieldAlert, Copy, Loader2 } from "lucide-react";
import { buildCurl } from "@/lib/mcp-docs/curlBuilder";
import { useMcpTestSession } from "@/lib/mcp-docs/testTokenStore";

interface Props {
  toolName: string;
  inputSchema: any;
  endpointReal: string;
  endpointDisplay: string;
  showEndpoint: boolean;
}

// Tools that must NOT be executable from the public docs (LLM/image credit consumers).
// Kept as a defensive allowlist for future tools — none currently match.
const CREDIT_HEAVY_PATTERNS = [/(^|_)generate_image(_|$)/i, /(^|_)llm(_|$)/i, /(^|_)ai_(generate|complete|chat)/i];
function isCreditHeavy(name: string) { return CREDIT_HEAVY_PATTERNS.some(rx => rx.test(name)); }

export function TryItPanel({ toolName, inputSchema, endpointReal, endpointDisplay, showEndpoint }: Props) {
  const initial = useMemo(() => exampleFromSchema(inputSchema), [inputSchema]);
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const shared = useMcpTestSession();
  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const token = tokenOverride ?? shared.token;
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; latency: number; body: unknown } | null>(null);
  const creditHeavy = isCreditHeavy(toolName);
  useEffect(() => { setTokenOverride(null); }, [shared.token]);

  const properties: Record<string, any> = inputSchema?.properties ?? {};
  const required: string[] = inputSchema?.required ?? [];

  async function execute() {
    if (!token.trim()) {
      toast.error("Cole um Access Token OAuth para executar.");
      return;
    }
    setLoading(true);
    setResponse(null);
    const started = performance.now();
    try {
      // Clean undefined
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== undefined && v !== "" && v !== null) body[k] = v;
      }
      const res = await fetch(`${endpointReal}/.mcp/invoke-tool/${toolName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${token.trim()}`,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* keep string */ }
      setResponse({ status: res.status, latency: Math.round(performance.now() - started), body: parsed });
    } catch (e) {
      setResponse({ status: 0, latency: Math.round(performance.now() - started), body: { error: (e as Error).message } });
    } finally {
      setLoading(false);
    }
  }

  function copyCurl() {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) if (v !== undefined && v !== "" && v !== null) cleaned[k] = v;
    const curl = buildCurl({
      endpoint: showEndpoint ? endpointReal : "{MCP_ENDPOINT}",
      toolName,
      body: cleaned,
    });
    navigator.clipboard.writeText(curl);
    toast.success("cURL copiado.");
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Play className="w-4 h-4 text-[#F28705]" /> Try it
        </h4>
        <Button size="sm" variant="ghost" onClick={copyCurl}><Copy className="w-3.5 h-3.5 mr-1" /> cURL</Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Access Token {shared.token ? "(preenchido pelo login de teste acima)" : ""}</Label>
        <Input
          type="password"
          value={token}
          onChange={(e) => setTokenOverride(e.target.value)}
          placeholder="Faça login acima ou cole um Access Token OAuth"
          className="h-9 font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          O token vive só nesta aba (sessionStorage). Você pode sobrescrever para testar com outro usuário.
        </p>
      </div>

      {Object.keys(properties).length > 0 ? (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Parâmetros</div>
          {Object.entries(properties).map(([name, schema]) => (
            <SchemaField
              key={name}
              name={name}
              schema={schema}
              required={required.includes(name)}
              value={values[name]}
              onChange={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Este endpoint não requer parâmetros.</p>
      )}

      <Button
        onClick={execute}
        disabled={loading || !token.trim() || creditHeavy}
        className="w-full bg-[#F28705] hover:bg-[#d97604] text-white"
      >
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando…</> : <><Play className="w-4 h-4 mr-2" /> Executar</>}
      </Button>

      {creditHeavy && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Este endpoint consome créditos de LLM/imagem e não pode ser executado a partir da documentação pública.
          </AlertDescription>
        </Alert>
      )}

      {!creditHeavy && !token.trim() && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Faça login no painel acima para gerar um Access Token, ou cole um token emitido pelo Orchestrator.
          </AlertDescription>
        </Alert>
      )}

      {response && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-md font-mono ${response.status >= 200 && response.status < 300 ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
              {response.status || "ERR"}
            </span>
            <span className="text-muted-foreground">{response.latency}ms</span>
            <span className="text-muted-foreground">· endpoint: {endpointDisplay}</span>
          </div>
          <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto max-h-72">
            <code>{typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
