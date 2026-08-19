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
import { Trash2, Crown, User, MoreVertical, ShieldCheck, ChevronDown, Clock, CalendarDays, Palmtree, AlertCircle, Plane, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TeamMember } from "@/hooks/useTeamMembers";
import type { TeamMemberAvailability, AvailabilityStatus } from "@/hooks/useTeamAvailability";
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
  availability?: TeamMemberAvailability;
}

const availabilityConfig: Record<
  AvailabilityStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  available: {
    label: "Disponível agora",
    icon: <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />,
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
  outside_hours: {
    label: "Fora do horário",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  day_off: {
    label: "Folga hoje",
    icon: <CalendarOff className="h-3 w-3" />,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
  vacation: {
    label: "Férias",
    icon: <Palmtree className="h-3 w-3" />,
    className: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-900",
  },
  leave: {
    label: "Licença",
    icon: <Plane className="h-3 w-3" />,
    className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
  },
  other_absence: {
    label: "Ausente",
    icon: <CalendarOff className="h-3 w-3" />,
    className: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  },
  holiday: {
    label: "Feriado",
    icon: <CalendarDays className="h-3 w-3" />,
    className: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  },
  unconfigured: {
    label: "Horário não configurado",
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-muted text-muted-foreground border-border",
  },
};

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
  availability,
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

          {member.profile.email && (
            <p className="text-xs text-muted-foreground break-all px-1">
              {member.profile.email}
            </p>
          )}
          
          <p className="text-xs text-muted-foreground">
            Entrou em {format(new Date(member.joined_at), "dd/MM/yyyy", { locale: ptBR })}
          </p>
          
          <div className="pt-1 space-y-2">
            {canModify && onRoleChange ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isChangingRole}
                    className="w-full flex justify-center"
                    title="Alterar cargo na equipe"
                  >
                    <Badge className={`${config.badgeColor} flex items-center gap-1 justify-center cursor-pointer hover:opacity-80 transition-opacity`}>
                      {config.icon}
                      {config.label}
                      <ChevronDown className="h-3 w-3" />
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem
                    disabled={member.role === "owner"}
                    onClick={() => setPromoteDialogOpen(true)}
                  >
                    <Crown className="h-4 w-4 mr-2 text-amber-500" />
                    Dono
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={member.role === "member"}
                    onClick={() => setDemoteDialogOpen(true)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Membro
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={`${config.badgeColor} flex items-center gap-1 justify-center`}>
                {config.icon}
                {config.label}
              </Badge>
            )}
            
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

            {/* Disponibilidade da equipe (independente do status online/offline) */}
            {availability && (
              <div className="pt-1 flex flex-col items-center gap-1">
                <Badge
                  variant="outline"
                  className={`gap-1 justify-center text-[10px] font-medium px-2 py-0.5 ${availabilityConfig[availability.status].className}`}
                >
                  {availabilityConfig[availability.status].icon}
                  {availabilityConfig[availability.status].label}
                </Badge>
                {(() => {
                  const detail = buildAvailabilityDetail(availability);
                  if (!detail) return null;
                  return (
                    <span className="text-[10px] text-muted-foreground leading-tight text-center">
                      {detail}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
