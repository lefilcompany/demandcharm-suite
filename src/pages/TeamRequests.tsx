import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeamJoinRequests, useRespondToRequest } from "@/hooks/useTeamJoinRequests";
import { useIsTeamOwner } from "@/hooks/useTeamRole";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Clock, CheckCircle, XCircle, UserPlus, Loader2, Users } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SEOHead } from "@/components/SEOHead";

export default function TeamRequests() {
  const { id: teamId } = useParams<{ id: string }>();
  const { selectedTeamId } = useSelectedTeam();
  const effectiveTeamId = teamId || selectedTeamId;

  const { data: requests, isLoading } = useTeamJoinRequests(effectiveTeamId);
  const { isOwner, isLoading: isLoadingRole } = useIsTeamOwner(effectiveTeamId);
  const respondToRequest = useRespondToRequest();

  const handleApprove = (request: NonNullable<typeof requests>[number]) => {
    if (!effectiveTeamId) return;

    respondToRequest.mutate(
      {
        requestId: request.id,
        teamId: effectiveTeamId,
        userId: request.user_id,
        status: "approved",
      },
      {
        onSuccess: () => {
          toast.success("Solicitação aprovada!", {
            description: "Novo membro adicionado à equipe.",
          });
        },
        onError: (error: any) => {
          toast.error("Erro ao aprovar solicitação", {
            description: getErrorMessage(error),
          });
        },
      }
    );
  };

  const handleReject = (request: NonNullable<typeof requests>[number]) => {
    if (!effectiveTeamId) return;

    respondToRequest.mutate(
      {
        requestId: request.id,
        teamId: effectiveTeamId,
        userId: request.user_id,
        status: "rejected",
      },
      {
        onSuccess: () => {
          toast.success("Solicitação rejeitada.");
        },
        onError: (error: any) => {
          toast.error("Erro ao rejeitar solicitação", {
            description: getErrorMessage(error),
          });
        },
      }
    );
  };

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <SEOHead title="Solicitações da Equipe" path="/team-requests" />
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto">
        <SEOHead title="Solicitações da Equipe" path="/team-requests" />
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>Você não tem permissão para acessar esta página.</p>
              <p className="text-sm mt-2">Apenas o dono da equipe pode gerenciar solicitações.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Solicitações da Equipe" path="/team-requests" />
      <PageBreadcrumb
        items={[
          
          { label: "Solicitações de Entrada", icon: UserPlus, isCurrent: true },
        ]}
      />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Solicitações de Entrada</h1>
        <p className="text-muted-foreground">
          Gerencie as solicitações de novos membros para sua equipe
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={request.profiles?.avatar_url || undefined} />
                    <AvatarFallback>
                      {request.profiles?.full_name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {request.profiles?.full_name || "Usuário"}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(request.requested_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    {request.profiles?.email && (
                      <p className="text-sm text-muted-foreground">
                        {request.profiles.email}
                      </p>
                    )}

                    {request.message && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        "{request.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(request)}
                      disabled={respondToRequest.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request)}
                      disabled={respondToRequest.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhuma solicitação pendente</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Quando alguém solicitar entrada na equipe, aparecerá aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
