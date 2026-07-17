import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { TryItPanel } from "./TryItPanel";
import { exampleFromSchema, exampleResponseFor } from "@/lib/mcp-docs/exampleFromSchema";
import { buildCurl } from "@/lib/mcp-docs/curlBuilder";
import { toast } from "sonner";

export interface ManifestTool {
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

interface Props {
  tool: ManifestTool;
  endpointReal: string;
  endpointDisplay: string;
  showEndpoint: boolean;
}

export function EndpointCard({ tool, endpointReal, endpointDisplay, showEndpoint }: Props) {
  const [open, setOpen] = useState(false);
  const example = exampleFromSchema(tool.inputSchema);
  const exampleRes = exampleResponseFor(tool.name);

  const method = tool.annotations?.readOnlyHint ? "GET" : tool.annotations?.destructiveHint ? "DELETE" : "POST";
  const methodColor =
    method === "GET" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
    : method === "DELETE" ? "bg-destructive/10 text-destructive border-destructive/30"
    : "bg-[#F28705]/10 text-[#F28705] border-[#F28705]/30";

  function copyExampleCurl() {
    navigator.clipboard.writeText(buildCurl({
      endpoint: showEndpoint ? endpointReal : "{MCP_ENDPOINT}",
      toolName: tool.name,
      body: example,
    }));
    toast.success("cURL copiado.");
  }

  return (
    <div id={`tool-${tool.name}`} className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${methodColor}`}>{method}</span>
        <code className="font-mono text-sm font-semibold">{tool.name}</code>
        <span className="text-sm text-muted-foreground truncate flex-1">{tool.description}</span>
        <div className="flex gap-1 shrink-0">
          {tool.annotations?.readOnlyHint && <Badge variant="secondary" className="text-[10px]">read-only</Badge>}
          {tool.annotations?.destructiveHint && <Badge variant="destructive" className="text-[10px]">destructive</Badge>}
          {tool.annotations?.idempotentHint && <Badge variant="outline" className="text-[10px]">idempotent</Badge>}
        </div>
      </button>

      {open && (
        <div className="border-t bg-background/50 p-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Descrição</h4>
              <p className="text-sm">{tool.description}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exemplo de requisição</h4>
                <Button size="sm" variant="ghost" onClick={copyExampleCurl}><Copy className="w-3.5 h-3.5 mr-1" /> cURL</Button>
              </div>
              <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto">
                <code>{`POST ${endpointDisplay}/.mcp/invoke-tool/${tool.name}
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <ACCESS_TOKEN>

${JSON.stringify(example, null, 2)}`}</code>
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Exemplo de resposta (200)</h4>
              <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto">
                <code>{JSON.stringify(exampleRes, null, 2)}</code>
              </pre>
            </div>

            {tool.inputSchema && Object.keys(tool.inputSchema?.properties ?? {}).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">Schema JSON completo</summary>
                <pre className="mt-2 bg-muted p-3 rounded-lg overflow-x-auto">
                  <code>{JSON.stringify(tool.inputSchema, null, 2)}</code>
                </pre>
              </details>
            )}
          </div>

          <TryItPanel
            toolName={tool.name}
            inputSchema={tool.inputSchema}
            endpointReal={endpointReal}
            endpointDisplay={endpointDisplay}
            showEndpoint={showEndpoint}
          />
        </div>
      )}
    </div>
  );
}
