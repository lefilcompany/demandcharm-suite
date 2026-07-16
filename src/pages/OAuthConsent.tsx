import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import logoSomaDark from "@/assets/logo-soma-dark.png";

type SupabaseOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): SupabaseOAuth | null {
  // The @supabase/supabase-js beta oauth namespace isn't in the generated types yet.
  const api = (supabase.auth as unknown as { oauth?: SupabaseOAuth }).oauth;
  return api ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!authorizationId) {
          setError("Solicitação de autorização inválida (authorization_id ausente).");
          return;
        }
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          const next = window.location.pathname + window.location.search;
          window.location.href = "/auth?next=" + encodeURIComponent(next);
          return;
        }
        setEmail(sess.session.user.email ?? null);
        const api = oauthApi();
        if (!api) {
          setError(
            "Seu navegador está com uma versão antiga do app em cache. Recarregue esta página com Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac) e tente novamente."
          );
          return;
        }
        const { data, error } = await api.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message || "Não foi possível carregar a autorização.");
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar a autorização.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const api = oauthApi();
      if (!api) {
        setError(
          "Seu navegador está com uma versão antiga do app em cache. Recarregue esta página com Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac) e tente novamente."
        );
        setBusy(false);
        return;
      }
      const { data, error } = approve
        ? await api.approveAuthorization(authorizationId)
        : await api.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message || "Não foi possível concluir a autorização.");
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("O servidor de autorização não retornou uma URL de retorno.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message || "Erro inesperado.");
      setBusy(false);
    }
  }

  const clientName = details?.client?.client_name || details?.client?.name || "Aplicativo externo";
  const redirectUri =
    details?.client?.redirect_uris?.[0] || details?.redirect_uri || null;
  const scopes: string[] = Array.isArray(details?.scopes)
    ? details.scopes
    : typeof details?.scope === "string"
    ? details.scope.split(/\s+/).filter(Boolean)
    : [];

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <img src={logoSomaDark} alt="SoMA" className="h-8 w-auto" />
          <div className="h-6 w-px bg-border" />
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">Autorização de acesso</span>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!details && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        )}

        {details && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">
                Conectar <span className="text-primary">{clientName}</span> à sua conta SoMA
              </h1>
              <p className="text-sm text-muted-foreground">
                Este aplicativo poderá chamar as ferramentas do SoMA em seu nome enquanto você
                estiver conectado. Suas permissões e políticas de acesso continuam válidas.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Conta</span>
                <span className="font-medium truncate">{email ?? "—"}</span>
              </div>
              {redirectUri && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Redirecionamento</span>
                  <span className="font-mono text-xs truncate max-w-[220px]">{redirectUri}</span>
                </div>
              )}
              {scopes.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Escopos</span>
                  <span className="text-xs">{scopes.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Autorizar
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Isto não altera suas permissões dentro do SoMA — apenas concede acesso ao
              aplicativo autenticado.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
