import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Users, Copy, Check, Calendar, Shield, Loader2, UserMinus, RefreshCw, Eye, EyeOff, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTeams, generateAccessCode, checkAccessCodeAvailable } from "@/hooks/useTeams";
import { useTeamMembers, useRemoveMember } from "@/hooks/useTeamMembers";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useTeamScope } from "@/hooks/useTeamScope";
import { useTeamPositions, useAssignPosition } from "@/hooks/useTeamPositions";
import { TeamScopeConfig } from "@/components/TeamScopeConfig";
import { TeamPositionsManager } from "@/components/TeamPositionsManager";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PositionBadge } from "@/components/PositionBadge";
import { PositionSelector } from "@/components/PositionSelector";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useRedeemCoupon } from "@/hooks/useTrialCoupon";
import { Ticket, CheckCircle2 } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  moderator: "Coordenador",
  executor: "Agente",
  requester: "Solicitante",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  moderator: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  executor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  requester: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function TeamConfig() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: members, isLoading: membersLoading } = useTeamMembers(selectedTeamId);
  const { data: myRole, isLoading: roleLoading } = useTeamRole(selectedTeamId);
  const { data: teamScope } = useTeamScope(selectedTeamId);
  const { data: positions } = useTeamPositions(selectedTeamId);
  const removeMember = useRemoveMember();
  const assignPosition = useAssignPosition();
  const queryClient = useQueryClient();
  const redeemCoupon = useRedeemCoupon();
  
  const [copied, setCopied] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [changeCodeOpen, setChangeCodeOpen] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingCode, setIsChangingCode] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [isCodeAvailable, setIsCodeAvailable] = useState<boolean | null>(null);
  const [codeSuggestions, setCodeSuggestions] = useState<string[]>([]);

  const team = teams?.find(t => t.id === selectedTeamId);
  const isAdmin = myRole === "owner";
  const isAdminOrModerator = myRole === "owner";

  // Redirect non-admins/moderators
  if (!roleLoading && !isAdminOrModerator && selectedTeamId) {
    navigate("/");
    return null;
  }

  const handleCopyCode = async () => {
    if (!team?.access_code) return;
    
    try {
      await navigator.clipboard.writeText(team.access_code);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar código");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember.mutateAsync(memberId);
      toast.success("Membro removido da equipe!");
    } catch (error) {
      toast.error("Erro ao remover membro");
    }
  };

  const handleNewCodeChange = async (value: string) => {
    const normalizedCode = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    setNewAccessCode(normalizedCode);
    setIsCodeAvailable(null);
    
    if (normalizedCode.length >= 6 && normalizedCode !== team?.access_code) {
      setIsCheckingCode(true);
      try {
        const available = await checkAccessCodeAvailable(normalizedCode);
        setIsCodeAvailable(available);
        if (!available) {
          // Generate suggestions
          setCodeSuggestions([generateAccessCode(), generateAccessCode(), generateAccessCode()]);
        }
      } catch (error) {
        console.error("Error checking code:", error);
        setIsCodeAvailable(null);
      } finally {
        setIsCheckingCode(false);
      }
    }
  };

  const handleGenerateNewCode = () => {
    const newCode = generateAccessCode();
    setNewAccessCode(newCode);
    setIsCodeAvailable(null);
    setCodeSuggestions([]);
    // Check availability after generating
    handleNewCodeChange(newCode);
  };

  const handleChangeAccessCode = async () => {
    if (!user?.email || !password || !newAccessCode || !selectedTeamId) return;
    
    setIsChangingCode(true);
    try {
      // Verify password by re-authenticating
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (authError) {
        toast.error("Senha incorreta");
        return;
      }

      // Check if new code already exists
      const { data: existingCode } = await supabase
        .rpc("check_access_code_exists", { code: newAccessCode.toUpperCase() });

      if (existingCode) {
        toast.error("Este código já está em uso. Tente outro.");
        return;
      }

      // Update the team access code
      const { error: updateError } = await supabase
        .from("teams")
        .update({ access_code: newAccessCode.toUpperCase() })
        .eq("id", selectedTeamId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Código de acesso alterado com sucesso!");
      setChangeCodeOpen(false);
      setNewAccessCode("");
      setPassword("");
    } catch (error: any) {
      console.error("Error changing access code:", error);
      toast.error("Erro ao alterar código de acesso");
    } finally {
      setIsChangingCode(false);
    }
  };

  if (teamsLoading || roleLoading) {
    return (
      <div className="space-y-6">
        <SEOHead title="Configurações da Equipe" />
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <SEOHead title="Configurações da Equipe" />
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Equipe não encontrada</h2>
        <p className="text-muted-foreground">Selecione uma equipe para ver suas configurações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <SEOHead title="Configurações da Equipe" />
      <PageBreadcrumb
        items={[
          { label: t("teams.title"), href: "/teams", icon: Users },
          { label: team?.name || "", href: `/teams/${selectedTeamId}` },
          { label: "Configurações", icon: Settings, isCurrent: true },
        ]}
      />
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações da Equipe</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Gerencie as configurações e membros da sua equipe
        </p>
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Team Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Informações da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome</label>
              <p className="text-lg font-semibold">{team.name}</p>
            </div>

            {team.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                <p className="text-sm">{team.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">Código de Acesso</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm break-all">
                  {team.access_code}
                </code>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleCopyCode} className="shrink-0">
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                {isAdmin && (
                  <Dialog open={changeCodeOpen} onOpenChange={(open) => {
                    setChangeCodeOpen(open);
                    if (!open) {
                      setNewAccessCode("");
                      setPassword("");
                      setShowPassword(false);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" title="Alterar código">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Alterar Código de Acesso</DialogTitle>
                        <DialogDescription>
                          Digite um novo código de acesso para a equipe. Para confirmar, insira sua senha.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-code">Novo Código de Acesso</Label>
                          <div className="flex gap-2">
                            <Input
                              id="new-code"
                              value={newAccessCode}
                              onChange={(e) => handleNewCodeChange(e.target.value)}
                              placeholder="Ex: TEAM2024XYZ"
                              maxLength={20}
                              className="font-mono uppercase"
                            />
                            <Button type="button" variant="outline" onClick={handleGenerateNewCode}>
                              Gerar
                            </Button>
                          </div>
                          
                          {/* Code availability indicator */}
                          {newAccessCode.length >= 6 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                {isCheckingCode ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-muted-foreground">Verificando...</span>
                                  </>
                                ) : isCodeAvailable === true ? (
                                  <>
                                    <Check className="h-4 w-4 text-emerald-500" />
                                    <span className="text-emerald-500">Código disponível</span>
                                  </>
                                ) : isCodeAvailable === false ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 text-destructive" />
                                    <span className="text-destructive">Código já em uso</span>
                                  </>
                                ) : null}
                              </div>
                              
                              {/* Suggestions when code is taken */}
                              {isCodeAvailable === false && codeSuggestions.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Sugestões disponíveis:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {codeSuggestions.map((suggestion, i) => (
                                      <Button
                                        key={i}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="font-mono text-xs"
                                        onClick={() => {
                                          setNewAccessCode(suggestion);
                                          setIsCodeAvailable(true);
                                          setCodeSuggestions([]);
                                        }}
                                      >
                                        {suggestion.slice(0, 10)}...
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <p className="text-xs text-muted-foreground">
                            Código atual: {team.access_code}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Confirme sua Senha</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Digite sua senha"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setChangeCodeOpen(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleChangeAccessCode} 
                          disabled={!newAccessCode || !password || isChangingCode || newAccessCode.length < 6 || isCodeAvailable === false || isCheckingCode}
                        >
                          {isChangingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Alterar Código
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Compartilhe este código para outros usuários entrarem na equipe
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Criado em</label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">
                  {format(new Date(team.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Scope Config */}
        {isAdmin && selectedTeamId && (
          <TeamScopeConfig teamId={selectedTeamId} currentScope={teamScope || null} />
        )}

        {/* Team Positions Manager */}
        {isAdminOrModerator && selectedTeamId && (
          <TeamPositionsManager 
            teamId={selectedTeamId} 
            canManage={isAdminOrModerator} 
            isAdmin={isAdmin} 
          />
        )}

        {/* Team Members */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Membros da Equipe
            </CardTitle>
            <CardDescription>
              {members?.length || 0} membros na equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : members && members.length > 0 ? (
              <div className="space-y-3">
                {members.map((member) => {
                  const isCurrentUser = member.user_id === user?.id;
                  const canEditMember = isAdmin && !isCurrentUser;
                  
                  return (
                    <div 
                      key={member.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                    >
                      <SEOHead title="Configurações da Equipe" />
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {member.profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {member.profile?.full_name || "Usuário"}
                            {isCurrentUser && <span className="text-muted-foreground ml-2">(você)</span>}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge className={`text-xs pointer-events-none ${roleColors[member.role] || ""}`}>
                              {roleLabels[member.role] || member.role}
                            </Badge>
                            {member.position && (
                              <PositionBadge 
                                name={member.position.name} 
                                color={member.position.color}
                                textColor={member.position.text_color}
                                showIcon={false}
                                className="text-xs"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Position Selector for Admins/Moderators */}
                      {isAdminOrModerator && positions && positions.length > 0 && (
                        <div className="w-full sm:w-40 shrink-0">
                          <PositionSelector
                            positions={positions}
                            value={member.position_id}
                            onChange={(positionId) => {
                              assignPosition.mutate(
                                { memberId: member.id, positionId },
                                {
                                  onSuccess: () => toast.success("Cargo atribuído!"),
                                  onError: () => toast.error("Erro ao atribuir cargo"),
                                }
                              );
                            }}
                            disabled={assignPosition.isPending}
                            placeholder="Atribuir cargo"
                          />
                        </div>
                      )}
                      
                      {canEditMember && (
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Membro</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover {member.profile?.full_name} da equipe? 
                                  O membro também será removido de todos os quadros.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum membro na equipe</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coupon Section */}
      {isAdmin && selectedTeamId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Aplicar Cupom de Teste
            </CardTitle>
            <CardDescription>Ative um período de teste grátis com um código de cupom</CardDescription>
          </CardHeader>
          <CardContent>
            {couponSuccess ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Teste grátis ativado com sucesso!</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: SOMA-ABC123"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <Button
                  disabled={!couponInput.trim() || redeemCoupon.isPending}
                  onClick={async () => {
                    try {
                      const result = await redeemCoupon.mutateAsync({
                        code: couponInput,
                        teamId: selectedTeamId,
                      });
                      toast.success("Teste grátis ativado!", {
                        description: `${result.trial_days} dias do plano ${result.plan_name}`,
                      });
                      setCouponSuccess(true);
                      queryClient.invalidateQueries({ queryKey: ["user-subscription"] });
                      queryClient.invalidateQueries({ queryKey: ["subscription"] });
                    } catch (e: any) {
                      toast.error(e.message || "Erro ao aplicar cupom");
                    }
                  }}
                >
                  {redeemCoupon.isPending ? "Aplicando..." : "Aplicar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
