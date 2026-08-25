import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plug, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { SectionShell } from "./SectionShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";

export function IntegrationsSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { connection, isLoading, refetch, connect, disconnect } = useGoogleCalendarConnection();

  // Handle the ?calendar=connected|error returned by the OAuth callback redirect.
  useEffect(() => {
    const result = searchParams.get("calendar");
    if (!result) return;
    if (result === "connected") {
      toast.success("Google Calendar conectado com sucesso.");
      refetch();
    } else {
      toast.error("Não foi possível conectar o Google Calendar. Tente novamente.");
    }
    const params = new URLSearchParams(searchParams);
    params.delete("calendar");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const available = connection?.available ?? false;
  const connected = connection?.connected ?? false;

  const handleConnect = () => {
    connect.mutate(undefined, {
      onError: () => toast.error("Não foi possível iniciar a conexão com o Google."),
    });
  };

  const handleDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success("Google Calendar desconectado."),
      onError: () => toast.error("Não foi possível desconectar o Google Calendar."),
    });
  };

  return (
    <SectionShell
      icon={Plug}
      title="Integrações"
      description="Conecte serviços externos à sua conta SoMA"
    >
      <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">Google Calendar</p>
              {!isLoading && !available && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Em breve
                </Badge>
              )}
              {available && connected && (
                <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 font-normal">
                  <CheckCircle2 className="h-3 w-3" />
                  Conectado
                </Badge>
              )}
            </div>

            {!available ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                A integração com o Google Calendar ainda não está disponível para a sua conta.
              </p>
            ) : connected ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {connection?.googleAccountEmail || "Conta Google conectada"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Não conectado — autorize o acesso à sua agenda do Google.
              </p>
            )}
          </div>
        </div>

        {available && (
          <div className="shrink-0">
            {isLoading ? (
              <Button variant="outline" size="sm" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Desconectar
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnect} disabled={connect.isPending}>
                {connect.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Conectar Google Calendar
              </Button>
            )}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
