import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Calendar, Key, Copy, Check, Settings, Trash2, Search, X } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTeams, useDeleteTeam } from "@/hooks/useTeams";
import { useTeamMembers, useRemoveMember, useUpdateMemberRole } from "@/hooks/useTeamMembers";
import { useIsTeamAdmin, useTeamRole } from "@/hooks/useTeamRole";
import { useTeamScope } from "@/hooks/useTeamScope";
import { useTeamPositions, useAssignPosition } from "@/hooks/useTeamPositions";
import { MemberCard } from "@/components/MemberCard";
import { TeamScopeConfig } from "@/components/TeamScopeConfig";
import { TeamPositionsManager } from "@/components/TeamPositionsManager";
import { TeamRole } from "@/hooks/useTeamRole";
import { SEOHead } from "@/components/SEOHead";
export default function TeamDetail() {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [copied, setCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const memberSearchRef = useRef<HTMLInputElement>(null);
  const {
    data: teams,
    isLoading: teamsLoading
  } = useTeams();
  const {
    data: members,
    isLoading: membersLoading
  } = useTeamMembers(id || null);
  const {
    isAdmin
  } = useIsTeamAdmin(id || null);
  const {
    data: role
  } = useTeamRole(id || null);
  const {
    data: scope
  } = useTeamScope(id || undefined);
  const { data: positions } = useTeamPositions(id);
  const removeMember = useRemoveMember();
  const updateMemberRole = useUpdateMemberRole();
  const assignPosition = useAssignPosition();
  const deleteTeam = useDeleteTeam();
  const team = teams?.find(t => t.id === id);
  const canManage = role === "owner";

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    moderator: "Coordenador",
    executor: "Agente",
    requester: "Solicitante",
  };

  const handlePositionChange = (memberId: string, positionId: string | null) => {
    assignPosition.mutate(
      { memberId, positionId },
      {
        onSuccess: () => toast.success("Cargo atribuído!"),
        onError: () => toast.error("Erro ao atribuir cargo"),
      }
    );
  };

  const handleRoleChange = (memberId: string, newRole: "owner" | "member") => {
    // Map UI roles to DB roles: owner→admin, member→requester
    const dbRole = newRole === "owner" ? "admin" : "requester";
    updateMemberRole.mutate(
      { memberId, newRole: dbRole as "admin" | "requester" },
      {
        onSuccess: () => toast.success(newRole === "owner" ? "Membro promovido a Dono!" : "Membro rebaixado!"),
        onError: (error: any) => toast.error(getErrorMessage(error)),
      }
    );
  };
  const handleCopyCode = () => {
    if (team?.access_code) {
      navigator.clipboard.writeText(team.access_code);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const handleRemoveMember = (memberId: string) => {
    removeMember.mutate(memberId, {
      onSuccess: () => {
        toast.success("Membro removido da equipe!");
      },
      onError: (error: any) => {
        toast.error("Erro ao remover membro", {
          description: getErrorMessage(error)
        });
      }
    });
  };
  const handleDeleteTeam = () => {
    if (!id) return;
    deleteTeam.mutate(id, {
      onSuccess: () => {
        toast.success("Equipe excluída com sucesso!");
        navigate("/teams");
      },
      onError: (error: any) => {
        toast.error("Erro ao excluir equipe", {
          description: getErrorMessage(error)
        });
      }
    });
  };
  if (teamsLoading) {
    return <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>;
  }
  if (!team) {
    return <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Equipe não encontrada</h2>
        <Button onClick={() => navigate("/teams")} className="mt-4">
          Voltar para Equipes
        </Button>
      </div>;
  }
  return <div className="space-y-6 animate-fade-in">
      <SEOHead title={`Equipe - ${team.name}`} />
      {/* Breadcrumbs */}
      <PageBreadcrumb
        items={[
          
          { label: team.name, isCurrent: true },
        ]}
      />

      {/* Team Access Code Card - For Admins/Moderators */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Código de Acesso da Equipe
            </CardTitle>
            <CardDescription>
              Compartilhe este código para convidar novos membros para a equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm">
                {team.access_code}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyCode}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scope Configuration - Only for Admins */}
      {isAdmin && id && <TeamScopeConfig teamId={id} currentScope={scope || null} />}

      {/* Team Positions Manager */}
      {canManage && id && (
        <TeamPositionsManager 
          teamId={id} 
          canManage={canManage} 
          isAdmin={isAdmin} 
        />
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membros da Equipe
              </CardTitle>
              <CardDescription>
                {isAdmin ? "Como administrador, você pode alterar papéis e remover membros." : "Visualize os membros da equipe e seus papéis."}
              </CardDescription>
            </div>
            {members && members.length > 3 && (
              <div className="shrink-0">
                {memberSearchOpen ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={memberSearchRef}
                      placeholder="Buscar por nome ou cargo..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-9 h-9 pr-8 w-[200px] sm:w-[260px]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setMemberSearchOpen(false);
                          setMemberSearch("");
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => { setMemberSearchOpen(false); setMemberSearch(""); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setMemberSearchOpen(true); setTimeout(() => memberSearchRef.current?.focus(), 50); }}
                  >
                    <Search className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Buscar</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div> : members && members.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {members.filter((member) => {
                if (!memberSearch.trim()) return true;
                const q = memberSearch.toLowerCase();
                const name = member.profile?.full_name?.toLowerCase() || "";
                const positionName = member.position?.name?.toLowerCase() || "";
                const roleLabel = roleLabels[member.role]?.toLowerCase() || "";
                return name.includes(q) || positionName.includes(q) || roleLabel.includes(q);
              }).sort((a, b) => {
                // Owners first, then members
                if (a.role === "owner" && b.role !== "owner") return -1;
                if (a.role !== "owner" && b.role === "owner") return 1;
                // Within same role, sort alphabetically by name
                return (a.profile?.full_name || "").localeCompare(b.profile?.full_name || "", "pt-BR");
              }).map(member => (
                <MemberCard 
                  key={member.id} 
                  member={member} 
                  isAdmin={isAdmin} 
                  currentUserId={user?.id || ""} 
                  onRemove={handleRemoveMember} 
                  isRemoving={removeMember.isPending}
                  canManage={canManage}
                  positions={positions || []}
                  onPositionChange={handlePositionChange}
                  isChangingPosition={assignPosition.isPending}
                  onRoleChange={canManage ? handleRoleChange : undefined}
                  isChangingRole={updateMemberRole.isPending}
                />
              ))}
            </div> : <p className="text-center text-muted-foreground py-8">
              Nenhum membro encontrado.
            </p>}
        </CardContent>
      </Card>
    </div>;
}