import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, Users, Trash2, UserPlus, UserMinus, ArrowLeft, Shield, UserCog, Briefcase, User, ChevronDown, Loader2, Pencil, Check, X, Search, Mail, ListChecks, AlertTriangle, CheckCircle2, Clock, Package as PackageIcon, ArrowUpRight } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useBoard, useDeleteBoard, useUpdateBoard } from "@/hooks/useBoards";
import { useBoardMembers, useBoardRole, useRemoveBoardMember, useUpdateBoardMemberRole, BoardRole } from "@/hooks/useBoardMembers";
import { useDemands } from "@/hooks/useDemands";
import { useBoardServicesWithUsage } from "@/hooks/useBoardServices";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";
import { useTeams } from "@/hooks/useTeams";
import { BoardScopeConfig } from "@/components/BoardScopeConfig";
import { BoardStagesPreview } from "@/components/BoardStagesPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, ListOrdered, Package } from "lucide-react";
import { AddBoardMemberDialog } from "@/components/AddBoardMemberDialog";
import { useAuth } from "@/lib/auth";
import { useTeamRole } from "@/hooks/useTeamRole";
import { toast } from "sonner";
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
  requester: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const roleBannerColors: Record<string, string> = {
  admin: "from-red-500/80 via-red-600 to-red-500/60",
  moderator: "from-blue-500/80 via-blue-600 to-blue-500/60",
  executor: "from-green-500/80 via-green-600 to-green-500/60",
  requester: "from-purple-500/80 via-purple-600 to-purple-500/60",
};

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Shield className="h-3.5 w-3.5" />,
  moderator: <UserCog className="h-3.5 w-3.5" />,
  executor: <Briefcase className="h-3.5 w-3.5" />,
  requester: <User className="h-3.5 w-3.5" />,
};

const roleOptions: BoardRole[] = ["admin", "moderator", "executor", "requester"];

// Native role selector component with smart positioning
function RoleSelector({
  currentRole,
  onRoleChange,
  isLoading,
  disabled,
}: {
  currentRole: BoardRole;
  onRoleChange: (role: BoardRole) => void;
  isLoading: boolean;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const computePos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownHeight;
    setMenuPos({
      top: openUpward ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      openUpward,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    computePos();
    const onScroll = () => computePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) computePos();
    setIsOpen(!isOpen);
  };

  const roleButtonColors: Record<string, string> = {
    admin: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/50",
    moderator: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50",
    executor: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50",
    requester: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/50",
  };

  if (disabled) {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full border font-medium ${roleButtonColors[currentRole] || ""}`}>
        {roleIcons[currentRole]}
        <span className="truncate max-w-[80px] sm:max-w-none">{roleLabels[currentRole] || currentRole}</span>
      </span>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`text-[11px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border font-medium flex items-center gap-1 sm:gap-1.5 transition-all duration-200 shadow-sm ${roleButtonColors[currentRole] || ""}`}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
        ) : (
          <>
            {roleIcons[currentRole]}
            <span className="truncate max-w-[70px] sm:max-w-none">{roleLabels[currentRole] || currentRole}</span>
            <ChevronDown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {isOpen && !isLoading && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.openUpward ? undefined : menuPos.top,
            bottom: menuPos.openUpward ? window.innerHeight - menuPos.top : undefined,
            left: menuPos.left,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
          className="min-w-[160px] bg-popover border rounded-xl shadow-xl py-1.5 animate-scale-in"
        >
          {roleOptions.map((role) => {
            const isSelected = role === currentRole;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  onRoleChange(role);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 transition-all duration-150 ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-accent text-foreground"
                }`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-full ${
                  isSelected ? "bg-primary/20" : "bg-muted"
                }`}>
                  {roleIcons[role]}
                </span>
                <span className="flex-1">{roleLabels[role]}</span>
                {isSelected && (
                  <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

const getInitials = (name: string | undefined | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function BoardDetail() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const { data: board, isLoading: boardLoading } = useBoard(boardId || null);
  const { data: members, isLoading: membersLoading } = useBoardMembers(boardId || null);
  const { data: myBoardRole } = useBoardRole(boardId || null);
  const { data: myTeamRole } = useTeamRole(board?.team_id || null);
  const { data: teamMembers } = useTeamMembers(board?.team_id || null);
  const { data: demands } = useDemands(boardId || undefined);
  const { data: boardServicesUsage } = useBoardServicesWithUsage(boardId || null);
  const { data: boardStatuses } = useBoardStatuses(boardId || null);
  const { data: teams } = useTeams();
  const deleteBoard = useDeleteBoard();
  const updateBoard = useUpdateBoard();
  const removeMember = useRemoveBoardMember();
  const updateRole = useUpdateBoardMemberRole();

  // Edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const memberSearchRef = useRef<HTMLInputElement>(null);

  // Team owner always has management access, board role is secondary
  const effectiveRole = myTeamRole === "owner" ? "admin" : myBoardRole;
  const canManage = effectiveRole === "admin" || effectiveRole === "moderator";
  const isAdmin = effectiveRole === "admin";
  const isRequester = effectiveRole === "requester";

  // Aggregated overview metrics
  const team = useMemo(
    () => teams?.find((t: any) => t.id === board?.team_id),
    [teams, board?.team_id],
  );
  const overviewMetrics = useMemo(() => {
    const list = demands ?? [];
    const total = list.length;
    const deliveredStatusIds = new Set(
      (boardStatuses ?? []).filter((s: any) => s.name === "Entregue").map((s: any) => s.id),
    );
    const delivered = list.filter((d: any) => deliveredStatusIds.has(d.status_id)).length;
    const inProgress = total - delivered;
    const now = Date.now();
    const overdue = list.filter((d: any) => {
      if (deliveredStatusIds.has(d.status_id)) return false;
      if (!d.due_date) return false;
      return new Date(d.due_date).getTime() < now;
    }).length;
    return { total, delivered, inProgress, overdue };
  }, [demands, boardStatuses]);
  const servicesCount = boardServicesUsage?.length ?? 0;
  const stagesCount = boardStatuses?.length ?? 0;

  // Initialize edit values when board loads
  useEffect(() => {
    if (board) {
      setEditName(board.name);
      setEditDescription(board.description || "");
    }
  }, [board]);

  const handleSaveName = async () => {
    if (!board || !editName.trim()) return;
    try {
      await updateBoard.mutateAsync({ id: board.id, name: editName.trim() });
      setIsEditingName(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleSaveDescription = async () => {
    if (!board) return;
    try {
      await updateBoard.mutateAsync({ id: board.id, description: editDescription.trim() || null });
      setIsEditingDescription(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCancelName = () => {
    setEditName(board?.name || "");
    setIsEditingName(false);
  };

  const handleCancelDescription = () => {
    setEditDescription(board?.description || "");
    setIsEditingDescription(false);
  };

  const handleDeleteBoard = async () => {
    if (!board) return;
    
    try {
      await deleteBoard.mutateAsync({ boardId: board.id, teamId: board.team_id });
      toast.success("Quadro excluído com sucesso!");
      navigate("/boards");
    } catch (error) {
      toast.error("Erro ao excluir quadro");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!boardId) return;
    
    try {
      await removeMember.mutateAsync({ memberId, boardId });
    } catch (error) {
      toast.error("Erro ao remover membro");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: BoardRole) => {
    if (!boardId) return;
    
    try {
      await updateRole.mutateAsync({ memberId, boardId, newRole });
    } catch (error) {
      toast.error("Erro ao alterar cargo");
    }
  };

  if (boardLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="text-center py-12">
        <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Quadro não encontrado</h2>
        <Button onClick={() => navigate("/boards")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Quadros
        </Button>
      </div>
    );
  }

  // Requester view - simplified with description and horizontal member list
  if (isRequester) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <SEOHead title={`Quadro - ${board.name}`} />
        {/* Breadcrumbs */}
        <PageBreadcrumb
          items={[
            { label: "Quadros", href: "/boards", icon: LayoutGrid },
            { label: board.name, isCurrent: true },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{board.name}</h1>
          </div>
        </div>

        {/* Description Card */}
        {board.description && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Descrição do Quadro</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{board.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Members - Grid Layout */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-5 w-5 shrink-0" />
              Membros do Quadro
            </CardTitle>
            <CardDescription className="text-sm">
              {members?.length || 0} membros neste quadro
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : members && members.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {members.map((member) => (
                  <div 
                    key={member.id} 
                    className="rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Colored Banner */}
                    <div className={`h-16 bg-gradient-to-r ${roleBannerColors[member.role] || "from-primary/80 via-primary to-primary/60"}`} />
                    
                    {/* Avatar positioned over banner */}
                    <div className="relative px-4 pb-4">
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                        <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                          <AvatarImage src={member.profile?.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="text-2xl bg-muted font-semibold">
                            {getInitials(member.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      {/* Member Info */}
                      <div className="pt-12 text-center">
                        <p className="font-semibold text-sm sm:text-base line-clamp-2 min-h-[2.5rem]">
                          {member.profile?.full_name || "Usuário"}
                        </p>
                        <Badge className={`text-xs mt-2 ${roleColors[member.role] || ""}`}>
                          {roleLabels[member.role] || member.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum membro neste quadro</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin/Moderator/Executor view - full view
  return (
    <div className="space-y-4 sm:space-y-6">
      <SEOHead title={`Quadro - ${board.name}`} />
      {/* Breadcrumbs */}
      <PageBreadcrumb
        items={[
          { label: "Quadros", href: "/boards", icon: LayoutGrid },
          { label: board.name, isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Editable Name */}
          <div className="flex flex-wrap items-center gap-2">
            {isEditingName && canManage ? (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xl font-bold"
                  placeholder="Nome do quadro"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelName();
                  }}
                />
                <Button size="icon" variant="ghost" onClick={handleSaveName} disabled={!editName.trim() || updateBoard.isPending}>
                  {updateBoard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancelName}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{board.name}</h1>
                {canManage && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Editable Description */}
          {isEditingDescription && canManage ? (
            <div className="flex items-start gap-2 max-w-lg">
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="text-sm min-h-[60px]"
                placeholder="Descrição do quadro (opcional)"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleCancelDescription();
                }}
              />
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={handleSaveDescription} disabled={updateBoard.isPending}>
                  {updateBoard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancelDescription}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              {board.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">{board.description}</p>
              ) : canManage ? (
                <p className="text-sm text-muted-foreground/60 italic">Clique para adicionar descrição</p>
              ) : null}
              {canManage && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => setIsEditingDescription(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="shrink-0">
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Excluir Quadro</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Quadro</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o quadro "{board.name}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteBoard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Tabs - profile-style configuration */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão geral</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Membros</span>
          </TabsTrigger>
          <TabsTrigger value="stages" className="gap-2">
            <ListOrdered className="h-4 w-4" />
            <span className="hidden sm:inline">Etapas</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Serviços</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview - quick stats summary */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Demand metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/kanban/${board.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/kanban/${board.id}`); } }}
              className="group relative cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5"
            >
              <ArrowUpRight className="absolute top-3 right-3 h-4 w-4 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" /> Demandas
                </CardDescription>
                <CardTitle className="text-3xl">{overviewMetrics.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Total ativas no quadro</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" /> Em andamento
                </CardDescription>
                <CardTitle className="text-3xl">{overviewMetrics.inProgress}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Ainda não entregues</p>
              </CardContent>
            </Card>

            <Card className={overviewMetrics.overdue > 0 ? "border-destructive/40" : ""}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <AlertTriangle className={`h-3.5 w-3.5 ${overviewMetrics.overdue > 0 ? "text-destructive" : "text-muted-foreground"}`} /> Atrasadas
                </CardDescription>
                <CardTitle className={`text-3xl ${overviewMetrics.overdue > 0 ? "text-destructive" : ""}`}>
                  {overviewMetrics.overdue}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Passaram do prazo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Entregues
                </CardDescription>
                <CardTitle className="text-3xl">{overviewMetrics.delivered}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {overviewMetrics.total > 0
                    ? `${Math.round((overviewMetrics.delivered / overviewMetrics.total) * 100)}% concluídas`
                    : "Nenhuma demanda ainda"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Configuration metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab("members")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("members"); } }}
              className="group relative cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5"
            >
              <ArrowUpRight className="absolute top-3 right-3 h-4 w-4 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Membros
                </CardDescription>
                <CardTitle className="text-2xl">{members?.length ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Pessoas com acesso</p>
              </CardContent>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab("stages")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("stages"); } }}
              className="group relative cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5"
            >
              <ArrowUpRight className="absolute top-3 right-3 h-4 w-4 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ListOrdered className="h-3.5 w-3.5" /> Etapas
                </CardDescription>
                <CardTitle className="text-2xl">{stagesCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Configuradas no fluxo</p>
              </CardContent>
            </Card>

            <Card
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab("services")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("services"); } }}
              className="group relative cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5"
            >
              <ArrowUpRight className="absolute top-3 right-3 h-4 w-4 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <PackageIcon className="h-3.5 w-3.5" /> Serviços
                </CardDescription>
                <CardTitle className="text-2xl">{servicesCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Disponíveis no quadro</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Equipe
                </CardDescription>
                <CardTitle className="text-base truncate">{team?.name || "—"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Criado em {new Date(board.created_at).toLocaleDateString("pt-BR")}
                  {board.is_default && " · Padrão"}
                </p>
              </CardContent>
            </Card>
          </div>

          <BoardStagesPreview boardId={board.id} canEdit={canManage} />
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Users className="h-5 w-5 shrink-0" />
                    <span className="truncate">Membros do Quadro</span>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {members?.length || 0} membros neste quadro
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {members && members.length > 3 && (
                    memberSearchOpen ? (
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
                    )
                  )}
                  {canManage && (
                    <AddBoardMemberDialog
                      boardId={board.id}
                      trigger={
                        <Button size="sm" className="shrink-0">
                          <UserPlus className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Adicionar</span>
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 sm:h-40 rounded-xl" />
                  ))}
                </div>
              ) : members && members.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {members.filter((member) => {
                    if (!memberSearch.trim()) return true;
                    const q = memberSearch.toLowerCase();
                    const name = member.profile?.full_name?.toLowerCase() || "";
                    const roleLabel = roleLabels[member.role]?.toLowerCase() || "";
                    const email = member.profile?.email?.toLowerCase() || "";
                    const tm = teamMembers?.find(m => m.user_id === member.user_id);
                    const positionName = tm?.position?.name?.toLowerCase() || "";
                    return name.includes(q) || roleLabel.includes(q) || email.includes(q) || positionName.includes(q);
                  }).map((member) => {
                    const isCurrentUser = member.user_id === user?.id;
                    const canChangeRole = isAdmin && !isCurrentUser;

                    return (
                      <div
                        key={member.id}
                        className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow relative group overflow-hidden"
                      >
                        <div className={`h-12 sm:h-14 bg-gradient-to-r ${roleBannerColors[member.role] || "from-primary/80 via-primary to-primary/60"}`} />

                        {isCurrentUser && (
                          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/90 dark:bg-background/90 text-primary shadow-md backdrop-blur-sm border border-white/50 dark:border-border">
                              <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                              Você
                            </span>
                          </div>
                        )}

                        {canManage && !isCurrentUser && (
                          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="secondary" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 bg-background/80 hover:bg-background text-destructive hover:text-destructive">
                                  <UserMinus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover Membro</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover {member.profile?.full_name} deste quadro?
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

                        <div className="relative px-3 sm:px-4 pb-3 sm:pb-4">
                          <div className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2">
                            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-[3px] sm:border-4 border-background shadow-lg">
                              <AvatarImage src={member.profile?.avatar_url || undefined} className="object-cover" />
                              <AvatarFallback className="text-lg sm:text-xl bg-muted font-semibold">
                                {getInitials(member.profile?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className="pt-9 sm:pt-10 text-center flex flex-col items-center gap-1 sm:gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/user/${member.user_id}`)}
                              className="font-semibold text-xs sm:text-sm line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] leading-tight w-full text-center hover:text-primary hover:underline decoration-primary cursor-pointer transition-colors"
                            >
                              {member.profile?.full_name || "Usuário"}
                            </button>
                            {member.profile?.email && (
                              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-full px-1">
                                <Mail className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 opacity-60" />
                                <span className="truncate">{member.profile.email}</span>
                              </div>
                            )}
                            <div className="flex flex-col items-center gap-1.5 pt-0.5">
                              {(() => {
                                const tm = teamMembers?.find(m => m.user_id === member.user_id);
                                return tm?.position ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full border font-medium"
                                    style={{
                                      backgroundColor: `${tm.position.color}15`,
                                      borderColor: `${tm.position.color}40`,
                                      color: tm.position.text_color || tm.position.color,
                                    }}
                                  >
                                    <Briefcase className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="truncate max-w-[70px] sm:max-w-none">{tm.position.name}</span>
                                  </span>
                                ) : null;
                              })()}
                              <RoleSelector
                                currentRole={member.role}
                                onRoleChange={(newRole) => handleRoleChange(member.id, newRole)}
                                isLoading={updateRole.isPending}
                                disabled={!canChangeRole}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum membro neste quadro</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages tab */}
        <TabsContent value="stages" className="mt-4">
          <BoardStagesPreview boardId={board.id} canEdit={canManage} />
        </TabsContent>

        {/* Services tab */}
        <TabsContent value="services" className="mt-4">
          <BoardScopeConfig boardId={board.id} canEdit={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
