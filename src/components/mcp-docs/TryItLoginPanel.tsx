import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, LogOut, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { setMcpTestSession, clearMcpTestSession, useMcpTestSession } from "@/lib/mcp-docs/testTokenStore";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "erxhxmetrvkigjwxchbj";
const LOGIN_URL = `https://${projectRef}.supabase.co/functions/v1/mcp-test-login`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export function TryItLoginPanel() {
  const session = useMcpTestSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isLoggedIn = !!session.token;
  const expiresLabel = session.expiresAt
    ? new Date(session.expiresAt * 1000).toLocaleString("pt-BR")
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.message ?? "Falha ao autenticar. Verifique suas credenciais.");
        return;
      }
      setMcpTestSession({
        access_token: data.access_token,
        email: data.user?.email ?? email.trim(),
        expires_at: data.expires_at ?? null,
      });
      setPassword("");
      toast.success("Token de teste gerado. Já preenchido no Try-it.");
    } catch (err) {
      toast.error("Erro de rede ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearMcpTestSession();
    toast.success("Sessão de teste encerrada.");
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-start gap-3">
        <KeyRound className="w-5 h-5 text-[#F28705] shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-sm">Autenticação de teste</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gere um <strong>Access Token real</strong> com seu login SoMA+ para testar os endpoints logo abaixo.
            O token é válido apenas nesta aba do navegador e respeita todas as políticas de RLS.
          </p>
        </div>
      </div>

      {isLoggedIn ? (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Autenticado como {session.email || "usuário"}</div>
            {expiresLabel && (
              <div className="text-[11px] text-muted-foreground">Token expira em {expiresLabel}</div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={logout}>
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sair
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="h-9"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Senha</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-9"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="h-9 bg-[#F28705] hover:bg-[#d97604] text-white"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Entrando…</> : "Gerar token"}
          </Button>
        </form>
      )}

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Use credenciais reais do SoMA+. O login não é persistido em <code>localStorage</code>; o token vive só em <code>sessionStorage</code> desta aba.
          Em produção, o Marketing OS Orchestrator conecta via <strong>OAuth 2.1 + PKCE</strong> — este login é apenas para testar a documentação.
        </AlertDescription>
      </Alert>
    </div>
  );
}
