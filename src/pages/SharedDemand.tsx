import { useState, useEffect, useRef, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";
import { useSharedDemand, useSharedDemandInteractions, useSharedDemandAttachments, useSharedDemandAutoJoin, joinBoardViaShareToken } from "@/hooks/useShareDemand";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, Users, Wrench, ExternalLink, Lock, MessageSquare, Loader2, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateOnlyBR } from "@/lib/dateUtils";
import { formatDemandCode } from "@/lib/demandCodeUtils";
import { cn } from "@/lib/utils";
import logoSoma from "@/assets/logo-soma.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { TeamContext } from "@/contexts/TeamContext";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { SEOHead } from "@/components/SEOHead";

export default function SharedDemand() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const teamContext = useContext(TeamContext);
  const { setSelectedBoardId } = useSelectedBoardSafe();
  const redirectedRef = useRef(false);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [autoJoinReason, setAutoJoinReason] = useState<string | null>(null);
  const { data: demand, isLoading, error } = useSharedDemand(token || null);
  const { data: interactions } = useSharedDemandInteractions(token || null, demand?.id || null);
  const { data: attachments } = useSharedDemandAttachments(token || null, demand?.id || null);
  const { data: autoJoinEnabled } = useSharedDemandAutoJoin(token || null);

  // Direct membership check - independent of selected team context
  useEffect(() => {
    if (redirectedRef.current || !demand?.id || !demand?.board_id || !session?.user) {
      if (!session?.user && demand) {
        setMembershipChecked(true);
      }
      return;
    }

    const checkMembership = async () => {
      try {
        const { data } = await supabase
          .from("board_members")
          .select("id")
          .eq("board_id", demand.board_id)
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (data) {
          redirectedRef.current = true;
          if (teamContext?.setSelectedTeamId && demand.team_id) {
            teamContext.setSelectedTeamId(demand.team_id);
          }
          setSelectedBoardId(demand.board_id);
          navigate(`/demands/${demand.id}`, { replace: true });
          return;
        }

        // Not a member — try auto-join if enabled on the token
        if (autoJoinEnabled && token) {
          try {
            const result = await joinBoardViaShareToken(token);
            if (result?.success && (result.reason === "joined" || result.reason === "already_member")) {
              redirectedRef.current = true;
              if (result.reason === "joined") {
                toast.success("Você foi adicionado ao quadro como Agente.");
              }
              if (teamContext?.setSelectedTeamId && demand.team_id) {
                teamContext.setSelectedTeamId(demand.team_id);
              }
              setSelectedBoardId(demand.board_id);
              navigate(`/demands/${demand.id}`, { replace: true });
              return;
            }
            setAutoJoinReason(result?.reason ?? "unknown");
          } catch (joinErr) {
            console.error("Auto-join failed:", joinErr);
            setAutoJoinReason("error");
          }
        }
      } catch (err) {
        console.error("Error checking board membership:", err);
      }
      setMembershipChecked(true);
    };

    checkMembership();
  }, [demand, session, autoJoinEnabled, token]);

  const comments = interactions?.filter((i: any) => i.interaction_type === "comment") || [];

  const formattedAssignees = demand?.demand_assignees?.map((a: any) => ({
    id: a.user_id,
    full_name: a.profile?.full_name || "Usuário",
    avatar_url: a.profile?.avatar_url,
  })) || [];

  // Show loading while checking membership for authenticated users
  if (isLoading || (session?.user && demand && !membershipChecked && !redirectedRef.current)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando demanda...</span>
        </div>
      </div>
    );
  }

  if (error || !demand) {
    const errorMessage = error?.message;
    const isExpired = errorMessage === "EXPIRED_TOKEN";
    const isInvalid = errorMessage === "INVALID_TOKEN";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
              isExpired ? "bg-amber-100 dark:bg-amber-950/30" : "bg-destructive/10"
            )}>
              {isExpired ? (
                <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-destructive" />
              )}
            </div>
            <h2 className="text-xl font-semibold">
              {isExpired ? "Link expirado" : isInvalid ? "Link inválido" : "Erro ao carregar"}
            </h2>
            <p className="text-muted-foreground">
              {isExpired
                ? "Este link de compartilhamento expirou. Solicite um novo link ao responsável pela demanda."
                : isInvalid
                ? "Este link de compartilhamento não é válido ou foi revogado."
                : "Não foi possível carregar esta demanda. Tente novamente mais tarde."}
            </p>
            <Button asChild>
              <Link to="/auth">Fazer login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sharedShortTitle = demand.title ? (demand.title.length > 50 ? demand.title.substring(0, 50) + "…" : demand.title) : "Demanda";
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={sharedShortTitle} />
      <header className="border-b bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSoma} alt="Logo" className="h-8" />
            <Badge variant="secondary" className="gap-1">
              <ExternalLink className="h-3 w-3" />
              {session?.user ? "Modo Somente Leitura" : "Visualização Pública"}
            </Badge>
          </div>
          {session?.user ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Voltar ao sistema</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/auth">
                <Lock className="mr-2 h-4 w-4" />
                Fazer login
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            {session?.user ? (
              autoJoinReason === "not_team_member" ? (
                <>
                  <strong>Você não faz parte da equipe deste quadro.</strong> Para entrar automaticamente no quadro através deste link, você precisa primeiro ser adicionado à equipe pelo administrador. Enquanto isso, está visualizando em <strong>modo somente leitura</strong>.
                </>
              ) : (
                <>
                  <strong>Você não é membro deste quadro.</strong> Está visualizando esta demanda em <strong>modo somente leitura</strong> através de um link de compartilhamento. Para editar, iniciar o timer, comentar ou interagir, peça ao responsável para adicioná-lo(a) como membro do quadro.
                </>
              )
            ) : (
              <>
                <strong>Modo de visualização:</strong> Você está visualizando esta demanda através de um link de compartilhamento.
                Para editar ou interagir, faça login no sistema.
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {demand.board_sequence_number && (
                  <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-muted-foreground/20 font-mono">
                    {formatDemandCode(demand.board_sequence_number)}
                  </Badge>
                )}
                {demand.demand_statuses && (
                  <Badge
                    style={{
                      backgroundColor: `${demand.demand_statuses.color}20`,
                      borderColor: `${demand.demand_statuses.color}40`,
                      color: demand.demand_statuses.color,
                    }}
                    className="gap-1"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: demand.demand_statuses.color }}
                    />
                    {demand.demand_statuses.name}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl md:text-2xl">{demand.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {demand.priority && <Badge variant="outline">{demand.priority}</Badge>}
                {demand.teams && <Badge variant="secondary">{demand.teams.name}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {demand.description && (
              <div>
                <h3 className="font-semibold mb-2 text-sm">Descrição</h3>
                <RichTextDisplay
                  content={demand.description}
                  className="text-sm text-muted-foreground"
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {demand.due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="font-medium">{formatDateOnlyBR(demand.due_date)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Serviço:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    demand.services?.name
                      ? "bg-primary/5 text-primary border-primary/20"
                      : "bg-muted/50 text-muted-foreground border-muted-foreground/20"
                  )}
                >
                  {demand.services?.name || "Nenhum serviço"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Responsáveis:</span>
                {formattedAssignees.length > 0 ? (
                  <div className="flex -space-x-2">
                    {formattedAssignees.slice(0, 3).map((assignee: any) => (
                      <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={assignee.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {assignee.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {formattedAssignees.length > 3 && (
                      <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                        +{formattedAssignees.length - 3}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum</span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Criada em:</span>
                <span className="font-medium">
                  {format(new Date(demand.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>

            <SharedAttachments attachments={attachments} token={token || ""} />
          </CardContent>
        </Card>

        {comments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comentários ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {comment.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{comment.profiles?.full_name || "Usuário"}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <RichTextDisplay content={comment.content || ""} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Visualização pública gerada pelo sistema de gestão de demandas</p>
        </div>
      </main>
    </div>
  );
}

function SharedAttachments({ attachments, token }: { attachments: any[] | undefined; token: string }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  if (!attachments || attachments.length === 0) return null;

  const handleAttachmentClick = async (attachment: any) => {
    if (!token) {
      toast.error("Link de compartilhamento inválido para abrir anexo.");
      return;
    }

    if (signedUrls[attachment.id]) {
      window.open(signedUrls[attachment.id], "_blank");
      return;
    }

    setLoadingIds((prev) => new Set(prev).add(attachment.id));

    try {
      const { data, error } = await supabase.functions.invoke("shared-attachment-url", {
        body: { token, filePath: attachment.file_path },
      });

      if (error) throw error;

      const signedUrl = (data as { signedUrl?: string } | null)?.signedUrl;
      if (!signedUrl) {
        throw new Error("SIGNED_URL_NOT_FOUND");
      }

      setSignedUrls((prev) => ({ ...prev, [attachment.id]: signedUrl }));
      window.open(signedUrl, "_blank");
    } catch (err) {
      console.error("Erro ao abrir anexo compartilhado:", err);
      toast.error("Não foi possível abrir o anexo agora. Tente novamente.");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(attachment.id);
        return next;
      });
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-2 text-sm">Anexos</h3>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment: any) => (
          <button
            key={attachment.id}
            onClick={() => handleAttachmentClick(attachment)}
            disabled={loadingIds.has(attachment.id)}
            className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors text-sm cursor-pointer disabled:opacity-50"
          >
            {loadingIds.has(attachment.id) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {attachment.file_name}
          </button>
        ))}
      </div>
    </div>
  );
}
