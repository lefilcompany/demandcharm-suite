import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MailCheck, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SEOHead } from "@/components/SEOHead";

type Scenario = "creation" | "deadline" | "generic";

const SCENARIO_LABEL: Record<Scenario, string> = {
  creation: "Criação de demanda",
  deadline: "Vencimento de demanda",
  generic: "Verificação genérica",
};

export default function AdminEmailTest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState(user?.email ?? "");
  const [scenario, setScenario] = useState<Scenario>("creation");
  const [sending, setSending] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["test-email-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_email_log")
        .select("id, recipient_email, scenario, subject, status, http_status, error_message, provider_message_id, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSend = async () => {
    if (!recipient) {
      toast.error("Informe um e-mail de destino");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { to: recipient, scenario },
      });
      if (error) throw error;
      if (data?.status === "accepted") {
        toast.success("E-mail aceito pelo provedor. Verifique a caixa de entrada.");
      } else {
        toast.error(`E-mail rejeitado: ${data?.error_message ?? "erro desconhecido"}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["test-email-log"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar teste");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <SEOHead title="Admin - Teste de E-mail" />

      <div>
        <h1 className="text-2xl font-semibold">Teste de e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Dispare um e-mail de prova e valide se as notificações de criação e vencimento estão sendo aceitas pelo provedor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" /> Enviar e-mail de teste
          </CardTitle>
          <CardDescription>
            O e-mail sai do remetente oficial (<code>noreply@pla.soma.lefil.com.br</code>) via Resend e o resultado é registrado abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_240px_auto]">
            <div className="space-y-2">
              <Label htmlFor="recipient">Destinatário</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="voce@exemplo.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
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
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Cenário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.recipient_email}</TableCell>
                      <TableCell className="text-sm">{SCENARIO_LABEL[log.scenario as Scenario] ?? log.scenario}</TableCell>
                      <TableCell>
                        {log.status === "accepted" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">Aceito</Badge>
                        ) : (
                          <Badge variant="destructive">Rejeitado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">
                        {log.status === "accepted"
                          ? log.provider_message_id ?? "—"
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
