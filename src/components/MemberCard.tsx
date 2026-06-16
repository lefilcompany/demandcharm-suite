import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Trash2, Crown, User, MoreVertical, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TeamMember } from "@/hooks/useTeamMembers";
import { TeamRole } from "@/hooks/useTeamRole";
import { PositionBadge } from "@/components/PositionBadge";
import { PositionSelector } from "@/components/PositionSelector";
import { TeamPosition } from "@/hooks/useTeamPositions";
import { useState } from "react";

interface MemberCardProps {
  member: TeamMember;
  isAdmin: boolean;
  currentUserId: string;
  onRemove: (memberId: string) => void;
  isRemoving: boolean;
  canManage?: boolean;
  positions?: TeamPosition[];
  onPositionChange?: (memberId: string, positionId: string | null) => void;
  isChangingPosition?: boolean;
  onRoleChange?: (memberId: string, newRole: "owner" | "member") => void;
  isChangingRole?: boolean;
}

const roleConfig: Record<TeamRole, { label: string; badgeColor: string; bannerColor: string; icon: React.ReactNode }> = {
  owner: {
    label: "Dono",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    bannerColor: "from-red-500/80 via-red-600 to-red-500/60",
    icon: <Crown className="h-3 w-3" />,
  },
  member: {
    label: "Membro",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    bannerColor: "from-blue-500/80 via-blue-600 to-blue-500/60",
    icon: <User className="h-3 w-3" />,
  },
};

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function MemberCard({
  member,
  isAdmin,
  currentUserId,
  onRemove,
  isRemoving,
  canManage = false,
  positions = [],
  onPositionChange,
  isChangingPosition = false,
  onRoleChange,
  isChangingRole = false,
}: MemberCardProps) {
  const navigate = useNavigate();
  const isCurrentUser = member.user_id === currentUserId;
  const canModify = isAdmin && !isCurrentUser;
  const config = roleConfig[member.role] || roleConfig.member;
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [demoteDialogOpen, setDemoteDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/user/${member.user_id}`);
  };

  const handlePositionChange = (positionId: string | null) => {
    if (onPositionChange) {
      onPositionChange(member.id, positionId);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group">
      <div className={`h-14 bg-gradient-to-r ${config.bannerColor}`} />
      
      {canModify && (
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full p-0 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] hover:bg-white/20 hover:text-white focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onRoleChange && member.role === "member" && (
                <DropdownMenuItem onClick={() => setPromoteDialogOpen(true)}>
                  <Crown className="h-4 w-4 mr-2 text-amber-500" />
                  Promover a Dono
                </DropdownMenuItem>
              )}
              {onRoleChange && member.role === "owner" && (
                <DropdownMenuItem onClick={() => setDemoteDialogOpen(true)}>
                  <User className="h-4 w-4 mr-2" />
                  Rebaixar a Membro
                </DropdownMenuItem>
              )}
              {onRoleChange && <DropdownMenuSeparator />}
              {member.role !== "owner" && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setRemoveDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover da equipe
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Remove confirmation - triggered from dropdown */}
      {canModify && (
        <>
          <AlertDialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Promover a Dono</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja promover <strong>{member.profile.full_name}</strong> a Dono da equipe?
                  Donos podem gerenciar membros, quadros, cargos e aceitar solicitações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRoleChange?.(member.id, "owner")}
                  disabled={isChangingRole}
                >
                  Promover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={demoteDialogOpen} onOpenChange={setDemoteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rebaixar a Membro</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja rebaixar <strong>{member.profile.full_name}</strong> a Membro?
                  Membros não podem gerenciar a equipe ou aceitar solicitações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRoleChange?.(member.id, "member")}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isChangingRole}
                >
                  Rebaixar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover membro</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover <strong>{member.profile.full_name}</strong> da equipe? 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onRemove(member.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isRemoving}
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      
      {isCurrentUser && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="text-xs bg-emerald-500 text-white shadow-md px-2.5 py-0.5 font-medium">
            Você
          </Badge>
        </div>
      )}
      
      <div className="relative px-4 pb-4">
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
            <AvatarImage src={member.profile.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="text-xl bg-muted font-semibold">
              {getInitials(member.profile.full_name)}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <div className="pt-10 text-center space-y-2">
          <button
            type="button"
            onClick={handleNameClick}
            className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] hover:text-primary hover:underline cursor-pointer transition-colors w-full text-center"
          >
            {member.profile.full_name}
          </button>
          
          <p className="text-xs text-muted-foreground">
            Entrou em {format(new Date(member.joined_at), "dd/MM/yyyy", { locale: ptBR })}
          </p>
          
          <div className="pt-1 space-y-2">
            <Badge className={`${config.badgeColor} flex items-center gap-1 justify-center`}>
              {config.icon}
              {config.label}
            </Badge>
            
            {canManage && positions.length > 0 ? (
              <PositionSelector
                positions={positions}
                value={member.position_id}
                onChange={handlePositionChange}
                disabled={isChangingPosition}
                placeholder="Atribuir cargo"
              />
            ) : member.position ? (
              <PositionBadge
                name={member.position.name}
                color={member.position.color}
                textColor={member.position.text_color}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
