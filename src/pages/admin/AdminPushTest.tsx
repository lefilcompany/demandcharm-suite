import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, BellRing, Loader2, RefreshCw, Send, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SEOHead } from "@/components/SEOHead";

type Scenario = "creation" | "deadline" | "mention" | "generic";

const SCENARIO_LABEL: Record<Scenario, string> = {
  creation: "Criação de demanda",
  deadline: "Vencimento próximo",
  mention: "Menção em demanda",
  generic: "Verificação genérica",
};

export default function AdminPushTest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const push = usePushNotifications();
  const [targetEmail, setTargetEmail] = useState(user?.email ?? "");
  const [scenario, setScenario] = useState<Scenario>("generic");
  const [sending, setSending] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      await push.enablePushNotifications();
    } finally {
      setEnabling(false);
    }
  };

  const swScriptUrl = typeof navigator !== "undefined"
    ? navigator.serviceWorker?.controller?.scriptURL ?? "—"
    : "—";
  const secureCtx = typeof window !== "undefined" ? String(window.isSecureContext) : "—";
  const notifPermission = typeof Notification !== "undefined" ? Notification.permission : "—";

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["test-push-log"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("test_push_log")
        .select("id, target_user_id, scenario, title, status, sent, failed, skipped, http_status, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        target_user_id: string;
        scenario: string;
        title: string;
        status: string;
        sent: number;
        failed: number;
        skipped: number;
        http_status: number | null;
        error_message: string | null;
        created_at: string;
      }>;
    },
  });

  const handleSend = async () => {
    const email = targetEmail.trim();
    if (!email) {
      toast.error("Informe o email do usuário destino");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-push", {
        body: { targetEmail: email, scenario },
      });
      if (error) throw error;
      if (data?.status === "accepted") {
        toast.success(`Push enviado (${data.sent} dispositivo(s)).`);
      } else {
        toast.warning(`Push rejeitado: ${data?.error_message ?? "erro desconhecido"}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["test-push-log"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar push";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };


  return (
    <div className="space-y-6">
      <SEOHead title="Admin - Teste de Push" />

      <div>
        <h1 className="text-2xl font-semibold">Teste de push (FCM)</h1>
        <p className="text-sm text-muted-foreground">
          Dispare uma notificação push de prova e valide se o FCM está entregando corretamente ao dispositivo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" /> Diagnóstico deste dispositivo
          </CardTitle>
          <CardDescription>
            Estado atual da configuração FCM neste navegador. Use "Ativar notificações" para reproduzir o erro e ver a causa exata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <DiagRow label="Suportado pelo navegador" value={String(push.isSupported)} />
            <DiagRow label="Contexto seguro (HTTPS)" value={secureCtx} />
            <DiagRow label="Permissão Notification" value={String(push.permissionStatus ?? notifPermission)} />
            <DiagRow label="Config FCM" value={push.configStatus} />
            <DiagRow label="Origem da config" value={push.configSource} />
            <DiagRow label="Campos faltando" value={push.configMissing.length ? push.configMissing.join(", ") : "nenhum"} />
            <DiagRow label="Token FCM ativo" value={push.fcmToken ? `${push.fcmToken.slice(0, 12)}…` : "—"} />
            <DiagRow label="SW controlador" value={swScriptUrl} />
          </div>
          {push.lastError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Último erro capturado</p>
              <p className="mt-1"><span className="font-mono text-xs">reason:</span> {push.lastError.reason}</p>
              <p className="break-all"><span className="font-mono text-xs">error:</span> {push.lastError.message}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleEnable} disabled={enabling || push.isLoading}>
              {(enabling || push.isLoading) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />}
              Ativar notificações neste dispositivo
            </Button>
            <Button variant="outline" onClick={() => push.refreshConfigStatus()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Rechecar config
            </Button>
            {push.isEnabled && (
              <Button variant="ghost" onClick={() => push.disablePushNotifications()}>
                Desativar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" /> Enviar push de teste
          </CardTitle>
          <CardDescription>
            O resultado (aceito/rejeitado) e a contagem de dispositivos é registrado abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              O usuário destino precisa ter concedido permissão de notificação e ter pelo menos um token FCM cadastrado (registrado ao entrar na plataforma com o navegador). Se as preferências de push estiverem desabilitadas o envio é ignorado.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_240px_auto]">
            <div className="space-y-2">
              <Label htmlFor="target">Email do usuário destino</Label>
              <Input
                id="target"
                type="email"
                placeholder="usuario@exemplo.com"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Padrão: seu próprio email ({user?.email ?? "—"}). O ID é buscado automaticamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cenário</Label>
              <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCENARIO_LABEL) as Scenario[]).map((s) => (
                    <SelectItem key={s} value={s}>{SCENARIO_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSend} disabled={sending} className="w-full md:w-auto">
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar teste
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Histórico de testes</CardTitle>
            <CardDescription>Últimos 30 envios registrados.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum teste executado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Cenário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.target_user_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-sm">{SCENARIO_LABEL[log.scenario as Scenario] ?? log.scenario}</TableCell>
                      <TableCell>
                        {log.status === "accepted" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">Aceito</Badge>
                        ) : (
                          <Badge variant="destructive">Rejeitado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="text-emerald-600">{log.sent}✓</span>{" "}
                        <span className="text-destructive">{log.failed}✗</span>{" "}
                        <span className="text-muted-foreground">{log.skipped}⊘</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">
                        {log.status === "accepted"
                          ? "Entregue ao FCM"
                          : log.error_message ?? `HTTP ${log.http_status ?? "?"}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-right break-all">{value}</span>
    </div>
  );
}
