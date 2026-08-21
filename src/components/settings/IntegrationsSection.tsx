import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Você cancelou a autorização no Google.",
  invalid_state: "A sessão de autorização expirou. Tente novamente.",
  feature_disabled: "A integração ainda não está habilitada.",
  feature_not_available: "Sua conta não está autorizada a usar esta integração.",
  missing_credentials: "A integração ainda não está configurada.",
  token_exchange_failed: "O Google recusou a autorização. Tente novamente.",
  userinfo_failed: "Não foi possível confirmar a conta Google.",
  missing_refresh_token: "O Google não devolveu autorização permanente. Tente novamente.",
};

export function IntegrationsSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, connect, disconnect, refetch } = useGoogleCalendarConnection();

  const calendarParam = searchParams.get("calendar");
  const reasonParam = searchParams.get("reason");

  useEffect(() => {
    if (!calendarParam) return;
    if (calendarParam === "connected") {
      toast.success("Google Calendar conectado com sucesso.");
      refetch();
    } else {
      toast.error(ERROR_MESSAGES[reasonParam ?? ""] ?? "Não foi possível conectar o Google Calendar.");
    }
    const params = new URLSearchParams(searchParams);
    params.delete("calendar");
    params.delete("reason");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarParam, reasonParam]);

  const available = data?.available ?? false;
  const isConnected = available && data?.status === "connected";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Conecte serviços externos à sua conta SoMA+
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <CardDescription>
                Permite que o SoMA+ crie eventos na sua agenda Google.
              </CardDescription>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : !available ? (
            <Badge variant="secondary">Em breve</Badge>
          ) : isConnected ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
              Conectado
            </Badge>
          ) : (
            <Badge variant="outline">Não conectado</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <>
              {isConnected && data?.google_account_email && (
                <p className="text-sm text-muted-foreground">
                  Conta conectada: <span className="font-medium text-foreground">{data.google_account_email}</span>
                </p>
              )}
              {!available && (
                <p className="text-sm text-muted-foreground">
                  Esta integração está em preparação e será liberada em breve.
                </p>
              )}
              {isConnected ? (
                <Button
                  variant="outline"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Desconectar
                </Button>
              ) : (
                <Button
                  onClick={() => connect.mutate()}
                  disabled={!available || connect.isPending}
                >
                  {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Conectar Google Calendar
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
