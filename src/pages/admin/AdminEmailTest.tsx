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
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Eye, ImageOff, Info, Loader2, MailCheck, RefreshCw, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SEOHead } from "@/components/SEOHead";

type Scenario = "creation" | "deadline" | "generic" | "product_update";

const SCENARIO_LABEL: Record<Scenario, string> = {
  creation: "Criação de demanda",
  deadline: "Vencimento de demanda",
  generic: "Verificação genérica",
  product_update: "Novidade da plataforma",
};

const PRODUCT_UPDATE_DEFAULTS = {
  title: "Novo painel de relatórios",
  message:
    "Agora ficou mais fácil acompanhar a performance da sua operação. Conheça os novos recursos disponíveis no SoMA+.",
  actionText: "Conhecer novidade",
  ctaPath: "/reports",
};

export default function AdminEmailTest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState(user?.email ?? "");
  const [scenario, setScenario] = useState<Scenario>("creation");
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [fields, setFields] = useState(PRODUCT_UPDATE_DEFAULTS);
  const [withImage, setWithImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `product-update/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("email-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data, error } = await supabase.storage
        .from("email-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (error || !data?.signedUrl) throw error ?? new Error("Não foi possível gerar o link da imagem");
      setImageUrl(data.signedUrl);
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const isProductUpdate = scenario === "product_update";

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

  const buildBody = (extra: Record<string, unknown>) => ({
    scenario,
    ...(isProductUpdate ? fields : {}),
    ...(isProductUpdate && withImage && imageUrl ? { imageUrl } : {}),
    ...extra,
  });

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: buildBody({ preview: true }),
      });
      if (error) throw error;
      if (!data?.html) throw new Error(data?.error ?? "Não foi possível gerar a prévia");
      setPreviewHtml(data.html);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao gerar prévia");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!recipient) {
      toast.error("Informe um e-mail de destino");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: buildBody({ to: recipient }),
      });
      if (error) throw error;
      if (data?.status === "accepted") {
        toast.success("E-mail aceito pelo provedor. Verifique a caixa de entrada.");
      } else {
        toast.warning(`E-mail rejeitado: ${data?.error_message ?? data?.error ?? "erro desconhecido"}`);
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
            O resultado aceito ou rejeitado pelo Resend é registrado abaixo sem interromper a tela.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Com o remetente de teste do Resend, só é possível enviar para o e-mail dono da conta Resend. Para testar outros destinatários, verifique um domínio no Resend e configure o remetente verificado.
            </p>
          </div>
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
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handlePreview} disabled={previewing}>
                {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Visualizar e-mail
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar teste
              </Button>
            </div>
          </div>

          {isProductUpdate && (
            <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pu-title">Título</Label>
                <Input
                  id="pu-title"
                  maxLength={200}
                  value={fields.title}
                  onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pu-message">Resumo / mensagem</Label>
                <Textarea
                  id="pu-message"
                  rows={3}
                  maxLength={2000}
                  value={fields.message}
                  onChange={(e) => setFields((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pu-action">Texto do botão</Label>
                <Input
                  id="pu-action"
                  maxLength={80}
                  value={fields.actionText}
                  onChange={(e) => setFields((f) => ({ ...f, actionText: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Imagem da novidade</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={withImage ? "outline" : "default"}
                    size="sm"
                    onClick={() => setWithImage(false)}
                  >
                    <ImageOff className="h-4 w-4 mr-2" /> Sem imagem
                  </Button>
                  <Button
                    type="button"
                    variant={withImage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWithImage(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Com imagem
                  </Button>
                </div>
                {withImage && (
                  <div className="space-y-2 pt-1">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => handleImageSelect(e.target.files?.[0])}
                    />
                    {uploading && (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando imagem...
                      </p>
                    )}
                    {imageUrl && (
                      <div className="relative w-fit">
                        <img
                          src={imageUrl}
                          alt="Prévia da imagem da novidade"
                          className="max-h-40 rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute -right-2 -top-2 h-6 w-6"
                          onClick={() => setImageUrl(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">PNG ou JPG até 5MB. A imagem aparece abaixo do texto no e-mail.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pu-cta">Caminho do CTA</Label>
                <Input
                  id="pu-cta"
                  placeholder="/reports"
                  maxLength={200}
                  value={fields.ctaPath}
                  onChange={(e) => setFields((f) => ({ ...f, ctaPath: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Somente rotas internas iniciando com “/”.</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Esta prévia utiliza o mesmo template do envio de produção.
          </div>

          {previewHtml && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-md bg-white">
                <iframe
                  title="Prévia do e-mail"
                  srcDoc={previewHtml}
                  sandbox=""
                  className="h-[720px] w-full border-0"
                />
              </div>
            </div>
          )}
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
