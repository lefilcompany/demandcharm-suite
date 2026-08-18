import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Mail, Bell, Rocket, XCircle } from "lucide-react";

interface ReleaseRow {
  id: string;
  release_key: string;
  deployment_id: string | null;
  commit_sha: string | null;
  published_at: string | null;
  created_at: string;
  status: string;
  approval_status: string;
  approved_at: string | null;
  approval_note: string | null;
}

interface FeatureRow {
  id: string;
  release_id: string;
  announcement_key: string;
  title: string;
  summary: string | null;
  email_body: string | null;
  cta_path: string | null;
  cta_label: string | null;
  priority: string | null;
  audience_scope: string;
  email_enabled: boolean | null;
  inapp_enabled: boolean | null;
  status: string;
}

type ListStatus = "pending_approval" | "approved" | "rejected";

const STATUS_LABEL: Record<ListStatus, string> = {
  pending_approval: "Aguardando aprovação",
  approved: "Aprovadas",
  rejected: "Recusadas",
};

const AUDIENCE_LABEL: Record<string, string> = {
  global: "Todos os usuários",
  team: "Equipe específica",
  board: "Quadro específico",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

export default function AdminReleases() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ListStatus>("pending_approval");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-releases", status],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("review-release", {
        body: { action: "list", status },
      });
      if (error) throw error;
      return data as { releases: ReleaseRow[]; features: FeatureRow[] };
    },
  });

  const decide = useMutation({
    mutationFn: async ({ releaseId, action }: { releaseId: string; action: "approve" | "reject" }) => {
      const { data, error } = await supabase.functions.invoke("review-release", {
        body: { action, releaseId, note: notes[releaseId] ?? null },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.action === "approve" ? "Release aprovada" : "Release recusada",
        description:
          variables.action === "approve"
            ? "As novidades começaram a ser enviadas aos usuários."
            : "Nenhum aviso será enviado para esta publicação.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-releases"] });
    },
    onError: (error: Error) => {
      toast({ title: "Não foi possível concluir", description: error.message, variant: "destructive" });
    },
  });

  const releases = data?.releases ?? [];
  const features = data?.features ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Rocket className="h-6 w-6 text-primary" />
          Aprovação de novidades
        </h1>
        <p className="text-sm text-muted-foreground">
          Nenhum aviso de nova funcionalidade é enviado automaticamente. Publicações detectadas ficam aqui
          até que um administrador aprove o disparo.
        </p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as ListStatus)}>
        <TabsList>
          {(Object.keys(STATUS_LABEL) as ListStatus[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {STATUS_LABEL[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : releases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma publicação em “{STATUS_LABEL[status]}”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {releases.map((release) => {
            const releaseFeatures = features.filter((f) => f.release_id === release.id);
            const pending = release.approval_status === "pending_approval";
            const busy = decide.isPending && decide.variables?.releaseId === release.id;

            return (
              <Card key={release.id}>
                <CardHeader className="gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{release.release_key}</CardTitle>
                    <Badge variant="outline">{release.status}</Badge>
                    {release.approval_status === "approved" && (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Aprovada</Badge>
                    )}
                    {release.approval_status === "rejected" && <Badge variant="destructive">Recusada</Badge>}
                  </div>
                  <CardDescription>
                    Detectada em {formatDate(release.created_at)} · Publicada em {formatDate(release.published_at)}
                    {release.deployment_id ? ` · Deploy ${release.deployment_id}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {releaseFeatures.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Esta publicação não trouxe novidades cadastradas para anúncio.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {releaseFeatures.map((feature) => (
                        <div key={feature.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{feature.title}</span>
                            <Badge variant="secondary">
                              {AUDIENCE_LABEL[feature.audience_scope] ?? feature.audience_scope}
                            </Badge>
                            {feature.priority && <Badge variant="outline">{feature.priority}</Badge>}
                          </div>
                          {(feature.email_body || feature.summary) && (
                            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                              {feature.email_body || feature.summary}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> E-mail: {feature.email_enabled ? "sim" : "não"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bell className="h-3 w-3" /> No app: {feature.inapp_enabled ? "sim" : "não"}
                            </span>
                            {feature.cta_path && <span>CTA: {feature.cta_path}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pending && (
                    <>
                      <Separator />
                      <Textarea
                        placeholder="Observação interna (opcional)"
                        value={notes[release.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [release.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={busy}
                          onClick={() => decide.mutate({ releaseId: release.id, action: "approve" })}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Aprovar e enviar
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => decide.mutate({ releaseId: release.id, action: "reject" })}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Recusar
                        </Button>
                      </div>
                    </>
                  )}

                  {release.approval_note && !pending && (
                    <p className="text-xs text-muted-foreground">Observação: {release.approval_note}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
