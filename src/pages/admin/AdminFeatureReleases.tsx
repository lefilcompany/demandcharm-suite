import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellRing, Loader2, Mail, RefreshCw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SEOHead } from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface FeatureRelease {
  id: string;
  title: string;
  message: string;
  action_path: string;
  published_at: string;
  inapp_recipient_count: number;
  email_recipient_count: number;
  email_success_count: number;
  email_skipped_count: number;
  email_failure_count: number;
}

async function invokeReleaseFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("publish-feature-release", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminFeatureReleases() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionPath, setActionPath] = useState("/");

  const { data: releases = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-feature-releases"],
    queryFn: async () => {
      const data = await invokeReleaseFunction({ action: "list" });
      return (data?.releases ?? []) as FeatureRelease[];
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe o nome da novidade");
      if (!message.trim()) throw new Error("Descreva o que foi lançado");
      if (!actionPath.trim().startsWith("/")) {
        throw new Error("O caminho deve começar com /");
      }

      return invokeReleaseFunction({
        action: "publish",
        title: title.trim(),
        message: message.trim(),
        actionPath: actionPath.trim() || "/",
      });
    },
    onSuccess: async (data) => {
      const delivery = data?.release;
      toast.success(
        `Novidade publicada: ${delivery?.inapp_recipient_count ?? 0} notificações internas e ${delivery?.email_success_count ?? 0} e-mails enviados.`,
      );
      setTitle("");
      setMessage("");
      setActionPath("/");
      await queryClient.invalidateQueries({ queryKey: ["admin-feature-releases"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar a novidade");
    },
  });

  return (
    <div className="space-y-6">
      <SEOHead title="Admin - Novidades da plataforma" />

      <div>
        <h1 className="text-2xl font-semibold">Novidades da plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Publique uma nova feature para avisar os usuários por e-mail e pelo sino de notificações do SoMA+.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Publicar novidade
          </CardTitle>
          <CardDescription>
            Os canais e o tipo “Novidades da plataforma” respeitam as preferências individuais de cada usuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feature-title">Nome da feature</Label>
            <Input
              id="feature-title"
              maxLength={200}
              placeholder="Ex.: Novo calendário de demandas"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-message">Mensagem</Label>
            <Textarea
              id="feature-message"
              maxLength={5000}
              rows={5}
              placeholder="Explique de forma curta o que mudou e por que isso é útil."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature-path">Página da novidade</Label>
            <Input
              id="feature-path"
              maxLength={500}
              placeholder="/"
              value={actionPath}
              onChange={(event) => setActionPath(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use um caminho interno, por exemplo <span className="font-mono">/reports</span> ou <span className="font-mono">/boards</span>.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
            <BellRing className="h-4 w-4 shrink-0 text-primary" />
            <span>In-app: aparece no sino e, para quem estiver online, também como alerta em tempo real.</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <span>E-mail: usa o template e o remetente já configurados no serviço <span className="font-mono">send-email</span>.</span>
          </div>

          <Button
            onClick={() => publish.mutate()}
            disabled={publish.isPending || !title.trim() || !message.trim()}
          >
            {publish.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {publish.isPending ? "Publicando..." : "Publicar e notificar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Histórico de lançamentos</CardTitle>
            <CardDescription>Últimas 30 novidades publicadas e o resultado da distribuição.</CardDescription>
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
          ) : releases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma novidade publicada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Novidade</TableHead>
                    <TableHead>Quando</TableHead>
                    <TableHead>In-app</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Falhas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((release) => (
                    <TableRow key={release.id}>
                      <TableCell className="min-w-[260px]">
                        <div className="font-medium">{release.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{release.message}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(release.published_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{release.inapp_recipient_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary">{release.email_success_count}/{release.email_recipient_count}</Badge>
                          {release.email_skipped_count > 0 && (
                            <span className="text-[11px] text-muted-foreground">{release.email_skipped_count} ignorados</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {release.email_failure_count > 0 ? (
                          <Badge variant="destructive">{release.email_failure_count}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
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
