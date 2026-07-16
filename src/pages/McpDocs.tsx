import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export default function McpDocs() {
  const endpoint = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/mcp`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>API MCP do SoMA — Documentação</title>
        <meta name="description" content="Servidor MCP do SoMA em reset. Apenas whoami disponível." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">API MCP do SoMA</h1>
          <p className="text-muted-foreground mt-2">
            Servidor em modo mínimo. Apenas a ferramenta <code>whoami</code> está disponível
            para validar a conexão OAuth. As demais serão restauradas em seguida.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Endpoint MCP</CardTitle></CardHeader>
          <CardContent>
            <code className="block text-xs bg-muted p-2 rounded break-all">{endpoint}</code>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => { navigator.clipboard.writeText(endpoint); toast.success("URL copiada"); }}>
              <Copy className="w-3 h-3 mr-2" /> Copiar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Como conectar</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal ml-4 space-y-2">
              <li>No seu cliente MCP (Claude Desktop, ChatGPT, Cursor), adicione um servidor MCP HTTP com a URL acima.</li>
              <li>Aprove o consent via OAuth 2.1.</li>
              <li>Chame <code>whoami</code> para confirmar que a sessão está ativa.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
