import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeamByAccessCode, useCreateJoinRequest, useExistingRequest, useIsTeamMember } from "@/hooks/useTeamJoinRequests";
import { ArrowLeft, Users, Clock, CheckCircle, XCircle, Loader2, KeyRound, Send, Sparkles, UserMinus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { supabase } from "@/integrations/supabase/client";
import logoSomaDark from "@/assets/logo-soma-dark.png";
import authBackground from "@/assets/auth-background.jpg";
import { SEOHead } from "@/components/SEOHead";

export default function JoinTeam() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");

  const { data: teamPreview, isLoading: isLoadingTeam } = useTeamByAccessCode(accessCode);
  const { data: existingRequest, isLoading: isLoadingRequest } = useExistingRequest(teamPreview?.id || null);
  const { data: isActiveMember, isLoading: isLoadingMember } = useIsTeamMember(teamPreview?.id || null);
  const createRequest = useCreateJoinRequest();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamPreview) return;

    createRequest.mutate(
      { teamId: teamPreview.id, message: message.trim() || undefined },
      {
        onSuccess: async () => {
          toast.success("Solicitação enviada com sucesso!", {
            description: "Aguarde a aprovação do administrador da equipe.",
          });
          await supabase.auth.signOut();
          navigate("/auth");
        },
        onError: (error: any) => {
          const msg = error.message?.toLowerCase() || "";
          if (msg.includes("duplicate") || msg.includes("unique")) {
            toast.warning("Você já possui uma solicitação pendente para esta equipe.");
          } else {
            toast.error("Erro ao enviar solicitação", {
              description: getErrorMessage(error),
            });
          }
        },
      }
    );
  };

  // Only block if request is pending, OR if approved AND user is still an active member
  const hasBlockingRequest = existingRequest && (
    existingRequest.status === "pending" ||
    (existingRequest.status === "approved" && isActiveMember)
  );
  
  // User can submit new request if:
  // 1. No existing request, OR
  // 2. Previous was rejected, OR
  // 3. Was approved but user was removed (not active member anymore)
  const canSubmitRequest = !existingRequest || 
    existingRequest.status === "rejected" ||
    (existingRequest.status === "approved" && !isActiveMember);

  const getStatusBadge = () => {
    if (!existingRequest) return null;

    // If approved but no longer an active member, user was removed
    if (existingRequest.status === "approved" && !isActiveMember) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-amber-500/10 text-amber-600 border-amber-500/20">
          <SEOHead title="Entrar em Equipe" path="/join-team" />
          <UserMinus className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium text-sm">
            Você foi removido desta equipe. Solicite entrada novamente.
          </span>
        </div>
      );
    }

    const statusConfig = {
      pending: {
        icon: Clock,
        text: "Solicitação pendente - aguardando aprovação",
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      },
      approved: {
        icon: CheckCircle,
        text: "Solicitação aprovada - você já é membro!",
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      },
      rejected: {
        icon: XCircle,
        text: "Sua solicitação anterior foi rejeitada. Você pode tentar novamente ou buscar outra equipe.",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      },
    };

    const config = statusConfig[existingRequest.status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config.className}`}>
        <SEOHead title="Entrar em Equipe" path="/join-team" />
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium text-sm">{config.text}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <SEOHead title="Entrar em Equipe" path="/join-team" />
      {/* Mobile/Tablet Header with Image */}
      <div 
        className="lg:hidden relative h-40 sm:h-48 overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-6 text-center">
          <img src={logoSomaDark} alt="SoMA" className="h-8 sm:h-10 w-auto mb-2" />
          <h2 className="text-lg font-semibold">Entrar em Equipe</h2>
        </div>
      </div>

      {/* Desktop Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <img src={logoSomaDark} alt="SoMA" className="h-12 w-auto" />
          </div>
          <div className="max-w-md">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 backdrop-blur mb-6">
              <KeyRound className="h-8 w-8" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold mb-6 leading-tight">
              Entrar em uma Equipe
            </h1>
            <p className="text-lg xl:text-xl text-white/90 leading-relaxed">
              Use o código de acesso fornecido pelo administrador para solicitar entrada na equipe.
            </p>
          </div>
          <div className="text-white/60 text-sm">
            O código de acesso tem entre 6 e 20 caracteres
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 lg:w-1/2 xl:w-2/5 flex items-start lg:items-center justify-center p-6 sm:p-8 md:p-12 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/welcome")}
            className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>

          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Código de Acesso
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Digite o código para encontrar a equipe
            </p>
          </div>

          <div className="space-y-5">
            {/* Access Code Input */}
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="text-base font-medium">
                Código
              </Label>
              <div className="relative">
                  <Input
                    id="accessCode"
                    placeholder="ABCD1234EFGH5678"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
                    maxLength={20}
                    className="h-14 text-xl font-mono tracking-[0.15em] uppercase text-center bg-muted/50 border-2 focus:border-primary transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium bg-background px-1">
                    {accessCode.length}/20
                  </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingTeam && accessCode.length >= 6 && (
              <div className="flex items-center justify-center gap-3 py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Buscando equipe...</span>
              </div>
            )}

            {/* Not Found State */}
            {!isLoadingTeam && accessCode.length >= 6 && !teamPreview && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                <XCircle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">Nenhuma equipe encontrada</span>
              </div>
            )}

            {/* Team Preview */}
            {teamPreview && (
              <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 rounded-2xl p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">
                          Equipe Encontrada
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-foreground truncate">
                        {teamPreview.name}
                      </h3>
                      {teamPreview.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {teamPreview.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isLoadingRequest && existingRequest && (
                    <div className="mt-4">{getStatusBadge()}</div>
                  )}
                </div>

                {/* Request Form - show if no blocking request */}
                {canSubmitRequest && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-base font-medium">
                        Mensagem
                        <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Apresente-se ou explique por que deseja entrar..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="resize-none bg-muted/50 border-2 focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/welcome")}
                        className="flex-1 h-12"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createRequest.isPending}
                        className="flex-1 h-12 gap-2"
                      >
                        {createRequest.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            {existingRequest?.status === "rejected" ? "Tentar Novamente" : "Solicitar Entrada"}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Back Button for blocking requests only */}
                {hasBlockingRequest && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full h-12"
                  >
                    Voltar ao Dashboard
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
