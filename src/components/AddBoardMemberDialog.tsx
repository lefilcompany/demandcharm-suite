import { useState, useMemo, useCallback } from "react";
import { useAddBoardMember, useAvailableTeamMembers, BoardRole } from "@/hooks/useBoardMembers";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UserPlus, Loader2, Shield, Users, Wrench, MessageSquare, Check, Search, ShieldCheck, Zap, User, ChevronRight, ArrowLeft, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TeamRole = "admin" | "moderator" | "executor" | "requester";

// Map for board roles (used in step 2 role selection and badge display)
const teamRoleConfig: Record<string, { label: string; badgeColor: string; bannerColor: string; icon: React.ReactNode }> = {
  admin: {
    label: "Administrador",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    bannerColor: "from-red-500/80 via-red-600 to-red-500/60",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  moderator: {
    label: "Coordenador",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    bannerColor: "from-blue-500/80 via-blue-600 to-blue-500/60",
    icon: <Shield className="h-3 w-3" />,
  },
  executor: {
    label: "Agente",
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    bannerColor: "from-green-500/80 via-green-600 to-green-500/60",
    icon: <Zap className="h-3 w-3" />,
  },
  requester: {
    label: "Solicitante",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    bannerColor: "from-purple-500/80 via-purple-600 to-purple-500/60",
    icon: <User className="h-3 w-3" />,
  },
  // Team-level roles from team_members table
  owner: {
    label: "Dono",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    bannerColor: "from-amber-500/80 via-amber-600 to-amber-500/60",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  member: {
    label: "Membro",
    badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    bannerColor: "from-slate-500/80 via-slate-600 to-slate-500/60",
    icon: <Users className="h-3 w-3" />,
  },
};

const boardRoleOptions: { value: BoardRole; label: string; shortLabel: string; description: string; icon: React.ElementType }[] = [
  { value: "admin", label: "Administrador", shortLabel: "Admin", description: "Acesso total ao quadro", icon: Shield },
  { value: "moderator", label: "Coordenador", shortLabel: "Coord", description: "Gerenciar demandas e membros", icon: Users },
  { value: "executor", label: "Agente", shortLabel: "Agente", description: "Executar e atualizar demandas", icon: Wrench },
  { value: "requester", label: "Solicitante", shortLabel: "Solic", description: "Apenas visualizar e solicitar", icon: MessageSquare },
];

interface SelectedMember {
  userId: string;
  role: BoardRole;
}

interface AddBoardMemberDialogProps {
  trigger?: React.ReactNode;
  boardId?: string;
}

export function AddBoardMemberDialog({ trigger, boardId: propBoardId }: AddBoardMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Map<string, BoardRole>>(new Map());
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"select" | "roles">("select");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  const { selectedBoardId: contextBoardId } = useSelectedBoard();
  const boardId = propBoardId || contextBoardId;

  const { data: availableMembers, isLoading: membersLoading } = useAvailableTeamMembers(
    selectedTeamId,
    boardId
  );
  const addMember = useAddBoardMember();

  const filteredMembers = useMemo(() => {
    if (!availableMembers) return [];
    if (!search.trim()) return availableMembers;
    const q = search.toLowerCase();
    return availableMembers.filter(
      (m: any) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.job_title?.toLowerCase().includes(q) ||
        teamRoleConfig[m.team_role as TeamRole]?.label.toLowerCase().includes(q)
    );
  }, [availableMembers, search]);

  const selectedList = useMemo(() => {
    if (!availableMembers) return [];
    return availableMembers.filter((m: any) => selectedMembers.has(m.user_id));
  }, [availableMembers, selectedMembers]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Map(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.set(userId, "executor");
      }
      return next;
    });
  }, []);

  const setMemberRole = useCallback((userId: string, role: BoardRole) => {
    setSelectedMembers((prev) => {
      const next = new Map(prev);
      next.set(userId, role);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!filteredMembers.length) return;
    setSelectedMembers((prev) => {
      const next = new Map(prev);
      const allSelected = filteredMembers.every((m: any) => next.has(m.user_id));
      if (allSelected) {
        filteredMembers.forEach((m: any) => next.delete(m.user_id));
      } else {
        filteredMembers.forEach((m: any) => {
          if (!next.has(m.user_id)) next.set(m.user_id, "executor");
        });
      }
      return next;
    });
  }, [filteredMembers]);

  const handleSubmit = async () => {
    if (!boardId || !user || selectedMembers.size === 0) return;
    setIsSubmitting(true);

    try {
      const entries = Array.from(selectedMembers.entries());
      for (const [userId, role] of entries) {
        await addMember.mutateAsync({
          boardId,
          userId,
          addedBy: user.id,
          role,
        });
      }
      toast.success(`${entries.length} membro${entries.length > 1 ? "s" : ""} adicionado${entries.length > 1 ? "s" : ""} ao quadro!`);
      resetAndClose();
    } catch {
      // error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setSelectedMembers(new Map());
    setSearch("");
    setStep("select");
  };

  const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every((m: any) => selectedMembers.has(m.user_id));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* STEP 1: Select members */}
        {step === "select" && (
          <>
            <DialogHeader className="flex-shrink-0 p-5 pb-3">
              <DialogTitle>Adicionar Membros ao Quadro</DialogTitle>
              <DialogDescription>
                Selecione um ou mais membros da equipe para adicionar ao quadro.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 pb-3 flex-shrink-0 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou cargo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filteredMembers.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-10 text-xs gap-1.5"
                  onClick={selectAll}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {allFilteredSelected ? "Desmarcar" : "Todos"}
                </Button>
              )}
            </div>

            <div className="flex-1 min-h-0">
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length > 0 ? (
                <ScrollArea className="h-[45vh]">
                  <div className="px-5 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredMembers.map((member: any) => {
                      const isSelected = selectedMembers.has(member.user_id);
                      const role = (member.team_role || "member") as string;
                      const config = teamRoleConfig[role] || teamRoleConfig.member;

                      return (
                        <button
                          key={member.user_id}
                          type="button"
                          onClick={() => toggleMember(member.user_id)}
                          className={cn(
                            "relative flex flex-col items-center rounded-xl border-2 overflow-hidden transition-all text-center",
                            isSelected
                              ? "border-primary shadow-md ring-1 ring-primary/30"
                              : "border-border hover:border-muted-foreground/30 hover:shadow-sm"
                          )}
                        >
                          {/* Gradient banner */}
                          <div className={cn("w-full h-10 bg-gradient-to-r", config.bannerColor)} />

                          {/* Avatar overlapping banner */}
                          <div className="-mt-5 relative">
                            <Avatar className="h-10 w-10 ring-2 ring-background">
                              <AvatarImage src={member.avatar_url || undefined} className="object-cover" />
                              <AvatarFallback className="text-sm font-semibold bg-muted">
                                {member.full_name?.charAt(0).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            {isSelected && (
                              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="px-2 pt-1.5 pb-3 space-y-1 w-full">
                            <p className="text-xs font-semibold truncate">{member.full_name}</p>
                            {member.job_title && (
                              <p className="text-[10px] text-muted-foreground truncate leading-tight">{member.job_title}</p>
                            )}
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 gap-1 font-medium", config.badgeColor)}>
                              {config.icon}
                              {config.label}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : availableMembers && availableMembers.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground px-5">
                  Todos os membros da equipe já estão neste quadro.
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground px-5">
                  Nenhum membro encontrado para "{search}".
                </div>
              )}
            </div>

            <DialogFooter className="p-5 pt-3 border-t">
              <div className="flex items-center justify-between w-full">
                <p className="text-sm text-muted-foreground">
                  {selectedMembers.size > 0 ? (
                    <span className="font-medium text-foreground">{selectedMembers.size} selecionado{selectedMembers.size > 1 ? "s" : ""}</span>
                  ) : (
                    "Nenhum selecionado"
                  )}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={resetAndClose}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => setStep("roles")}
                    disabled={selectedMembers.size === 0}
                  >
                    Definir Cargos
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}

        {/* STEP 2: Assign roles */}
        {step === "roles" && (
          <>
            <DialogHeader className="flex-shrink-0 p-5 pb-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setStep("select")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <DialogTitle>Definir Cargos no Quadro</DialogTitle>
                  <DialogDescription>
                    Escolha o cargo de cada membro no quadro.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0">
              <ScrollArea className="h-[50vh]">
                <div className="px-5 pb-3 space-y-2">
                  {selectedList.map((member: any) => {
                    const currentRole = selectedMembers.get(member.user_id) || "executor";
                    const teamRole = (member.team_role || "member") as string;
                    const teamConfig = teamRoleConfig[teamRole] || teamRoleConfig.member;

                    return (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={member.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="text-xs font-semibold bg-muted">
                            {member.full_name?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.full_name}</p>
                          <div className="flex items-center gap-1.5">
                            {member.job_title && (
                              <span className="text-[11px] text-muted-foreground truncate">{member.job_title}</span>
                            )}
                            {member.job_title && <span className="text-muted-foreground/40">·</span>}
                            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 gap-0.5 font-medium shrink-0", teamConfig.badgeColor)}>
                              {teamConfig.icon}
                              {teamConfig.label}
                            </Badge>
                          </div>
                        </div>
                        <TooltipProvider delayDuration={200}>
                          <div className="flex gap-1 shrink-0">
                            {boardRoleOptions.map((opt) => {
                              const Icon = opt.icon;
                              const isActive = currentRole === opt.value;
                              return (
                                <Tooltip key={opt.value}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setMemberRole(member.user_id, opt.value)}
                                      className={cn(
                                        "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border",
                                        isActive
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-transparent hover:bg-muted text-muted-foreground"
                                      )}
                                    >
                                      <Icon className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">{opt.shortLabel}</span>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-[180px]">
                                    <p className="font-semibold text-xs">{opt.label}</p>
                                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Bulk role setter */}
            <div className="px-5 py-2 border-t bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Aplicar a todos:</span>
              <TooltipProvider delayDuration={200}>
                <div className="flex gap-1">
                  {boardRoleOptions.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <Tooltip key={opt.value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMembers((prev) => {
                                const next = new Map(prev);
                                for (const key of next.keys()) {
                                  next.set(key, opt.value);
                                }
                                return next;
                              });
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {opt.shortLabel}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[180px]">
                          <p className="font-semibold text-xs">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              </div>
            </div>

            <DialogFooter className="p-5 pt-3 border-t">
              <div className="flex items-center justify-between w-full">
                <Button type="button" variant="ghost" onClick={() => setStep("select")}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar {selectedMembers.size} membro{selectedMembers.size > 1 ? "s" : ""}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
