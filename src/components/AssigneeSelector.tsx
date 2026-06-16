import { useState, useMemo, useEffect } from "react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { Users, X, Check, ShieldCheck, Shield, Zap, User, Search, Crown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Role = "admin" | "moderator" | "executor" | "requester";

const roleConfig: Record<Role, { label: string; badgeColor: string; bannerColor: string; icon: React.ReactNode }> = {
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
};

interface AssigneeSelectorProps {
  teamId: string | null;
  boardId?: string | null;
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  primaryUserId?: string | null;
  onPrimaryChange?: (userId: string | null) => void;
  disabled?: boolean;
  hideIcon?: boolean;
  restrictToUserIds?: string[];
  // Controlled mode
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
  onConfirm?: () => void | Promise<void>;
  confirmLoading?: boolean;
}

export function AssigneeSelector({
  teamId,
  boardId,
  selectedUserIds,
  onChange,
  primaryUserId,
  onPrimaryChange,
  disabled = false,
  hideIcon = false,
  restrictToUserIds,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  onConfirm,
  confirmLoading,
}: AssigneeSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const { data: teamMembers, isLoading: loadingTeam } = useTeamMembers(teamId);
  const { data: boardMembers, isLoading: loadingBoard } = useBoardMembers(
    boardId || null
  );

  // Effective primary: explicit prop OR fallback to first selected
  const effectivePrimary =
    primaryUserId && selectedUserIds.includes(primaryUserId)
      ? primaryUserId
      : selectedUserIds[0] ?? null;

  // Keep parent in sync if it tracks primary explicitly and our fallback differs
  useEffect(() => {
    if (!onPrimaryChange) return;
    if (primaryUserId === undefined) return;
    if (selectedUserIds.length === 0 && primaryUserId !== null) {
      onPrimaryChange(null);
      return;
    }
    if (selectedUserIds.length > 0 && (!primaryUserId || !selectedUserIds.includes(primaryUserId))) {
      onPrimaryChange(selectedUserIds[0]);
    }
  }, [selectedUserIds, primaryUserId, onPrimaryChange]);

  const allMembers = boardId
    ? boardMembers?.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as Role,
        profile: m.profile,
      }))
    : teamMembers?.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as Role,
        profile: m.profile,
      }));

  const members = restrictToUserIds && restrictToUserIds.length > 0
    ? allMembers?.filter((m) => restrictToUserIds.includes(m.user_id))
    : allMembers;

  const isLoading = boardId ? loadingBoard : loadingTeam;

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!search.trim()) return members;
    const q = search.toLowerCase().trim();
    return members.filter((m) =>
      m.profile?.full_name?.toLowerCase().includes(q)
    );
  }, [members, search]);

  const setPrimary = (userId: string | null) => {
    if (onPrimaryChange) onPrimaryChange(userId);
  };

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      const next = selectedUserIds.filter((id) => id !== userId);
      onChange(next);
      // If we removed the primary, promote the next one (or null)
      if (effectivePrimary === userId) {
        setPrimary(next[0] ?? null);
      }
    } else {
      const next = [...selectedUserIds, userId];
      onChange(next);
      // First selection becomes the primary by default
      if (next.length === 1) setPrimary(userId);
    }
  };

  const promoteToPrimary = (userId: string) => {
    if (!selectedUserIds.includes(userId)) {
      // also auto-add to selection
      onChange([...selectedUserIds, userId]);
    }
    setPrimary(userId);
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const selectedMembers = members?.filter((m) =>
    selectedUserIds.includes(m.user_id)
  );

  const primaryMember = selectedMembers?.find((m) => m.user_id === effectivePrimary);
  const followerMembers = selectedMembers?.filter((m) => m.user_id !== effectivePrimary) ?? [];

  // Available members for the "Acompanhantes" section: selected (non-primary) + filtered list excluding primary
  const followersAreaMembers = filteredMembers.filter((m) => m.user_id !== effectivePrimary);
  const primarySectionMembers = filteredMembers; // all visible; we show crown CTA on each

  const handleOpen = () => {
    if (!disabled && (teamId || boardId)) setOpen(true);
  };

  return (
    <>
      {/* Trigger Button */}
      {!hideTrigger && (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled || (!teamId && !boardId)}
          className={cn(
            "w-full h-8 flex items-center justify-start gap-2 px-3 py-1 rounded-md border border-input bg-background text-sm shadow-none",
            "hover:bg-white hover:text-[#F28705] hover:border-[#F28705] transition-[border-color,box-shadow,background-color,color] duration-200",
            "focus-visible:outline-none focus-visible:border-ring focus-visible:[box-shadow:var(--focus-ring)]",
            "disabled:opacity-50 disabled:pointer-events-none",
            !selectedUserIds.length && "text-muted-foreground"
          )}
        >
          {!hideIcon && <Users className="h-4 w-4 shrink-0" />}
          {selectedUserIds.length > 0 ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                {primaryMember && (
                  <div
                    className="relative h-5 w-5 rounded-full ring-2 ring-primary overflow-hidden bg-muted flex items-center justify-center shrink-0"
                    title={`Responsável: ${primaryMember.profile?.full_name ?? ""}`}
                  >
                    {primaryMember.profile?.avatar_url ? (
                      <img src={primaryMember.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {getInitials(primaryMember.profile?.full_name || "?")}
                      </span>
                    )}
                  </div>
                )}
                {followerMembers.slice(0, 2).map((member) => (
                  <div
                    key={member.user_id}
                    className="h-5 w-5 rounded-full ring-2 ring-background overflow-hidden bg-muted flex items-center justify-center shrink-0"
                  >
                    {member.profile?.avatar_url ? (
                      <img src={member.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {getInitials(member.profile?.full_name || "?")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-sm truncate">
                {primaryMember ? (
                  <>
                    <span className="font-medium">{primaryMember.profile?.full_name?.split(" ")[0]}</span>
                    {followerMembers.length > 0 && (
                      <span className="text-muted-foreground"> +{followerMembers.length} acomp.</span>
                    )}
                  </>
                ) : (
                  `${selectedUserIds.length} selecionado(s)`
                )}
              </span>
            </div>
          ) : (
            "Selecionar responsável"
          )}
        </button>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(""); setStep(1); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? "Passo 1: Definir Responsável" : "Passo 2: Adicionar Acompanhantes"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 1
                ? <>Escolha <strong>1 responsável</strong> que deve executar a demanda.</>
                : <>Selecione quem deve <strong>acompanhar</strong> a demanda (opcional). Acompanhantes também podem executar.</>}
            </p>
            {/* Stepper indicator */}
            <div className="flex items-center gap-2 mt-3">
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", step === 1 ? "bg-primary text-primary-foreground" : effectivePrimary ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                {effectivePrimary && step !== 1 ? <Check className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
                Responsável
              </div>
              <div className="h-px w-4 bg-border" />
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Eye className="h-3 w-3" />
                Acompanhantes
              </div>
            </div>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro por nome..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring transition-[border-color,box-shadow] duration-200 focus-visible:[box-shadow:var(--focus-ring)]"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Carregando...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground p-8 text-center">
                {search.trim() ? "Nenhum membro encontrado" : "Nenhum membro disponível"}
              </p>
            ) : (
              <>
                {step === 1 && (
                <section>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Crown className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Responsável <span className="text-muted-foreground font-normal">(escolha 1)</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                    {primarySectionMembers.map((member) => {
                      const isPrimary = effectivePrimary === member.user_id;
                      const config = roleConfig[member.role] || roleConfig.requester;
                      return (
                        <button
                          key={`primary-${member.id}`}
                          type="button"
                          onClick={() => promoteToPrimary(member.user_id)}
                          className={cn(
                            "relative rounded-xl border-2 bg-card overflow-hidden text-left transition-all",
                            "hover:shadow-md hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                            isPrimary ? "border-primary shadow-md ring-2 ring-primary/30" : "border-border"
                          )}
                        >
                          <div className={`h-10 bg-gradient-to-r ${config.bannerColor}`} />
                          {isPrimary && (
                            <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                              <Crown className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                          )}
                          <div className="relative px-3 pb-3">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                              <Avatar className="h-12 w-12 border-3 border-background shadow-lg">
                                <AvatarImage src={member.profile?.avatar_url || undefined} alt="" className="object-cover" />
                                <AvatarFallback className="text-sm bg-muted font-semibold">
                                  {getInitials(member.profile?.full_name || "?")}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="pt-8 text-center space-y-1.5">
                              <p className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                                {member.profile?.full_name}
                              </p>
                              <Badge className={cn("text-xs", config.badgeColor)}>
                                {config.icon}
                                <span className="ml-1">{config.label}</span>
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
                )}

                {step === 2 && (
                <section>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      Acompanhantes
                      <InfoTooltip text="Acompanhantes recebem atualizações da demanda e podem executá-la, mas a execução é preferencialmente feita pelo responsável." />
                    </h3>
                  </div>
                  {followersAreaMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">
                      Selecione um responsável acima para liberar a escolha de acompanhantes.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                      {followersAreaMembers.map((member) => {
                        const isSelected = selectedUserIds.includes(member.user_id);
                        const config = roleConfig[member.role] || roleConfig.requester;
                        return (
                          <button
                            key={`follower-${member.id}`}
                            type="button"
                            onClick={() => toggleUser(member.user_id)}
                            className={cn(
                              "relative rounded-xl border-2 bg-card overflow-hidden text-left transition-all",
                              "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                              isSelected ? "border-primary shadow-md" : "border-border"
                            )}
                          >
                            <div className={`h-10 bg-gradient-to-r ${config.bannerColor} opacity-80`} />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-md">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                            <div className="relative px-3 pb-3">
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                <Avatar className="h-12 w-12 border-3 border-background shadow-lg">
                                  <AvatarImage src={member.profile?.avatar_url || undefined} alt="" className="object-cover" />
                                  <AvatarFallback className="text-sm bg-muted font-semibold">
                                    {getInitials(member.profile?.full_name || "?")}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="pt-8 text-center space-y-1.5">
                                <p className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                                  {member.profile?.full_name}
                                </p>
                                <Badge className={cn("text-xs", config.badgeColor)}>
                                  {config.icon}
                                  <span className="ml-1">{config.label}</span>
                                </Badge>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-2">
            {selectedUserIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => { onChange([]); setPrimary(null); }}
                className="hover:bg-white hover:text-primary hover:border-primary"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <div className="flex-1" />
            {step === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="hover:bg-white hover:text-primary hover:border-primary"
              >
                Voltar
              </Button>
            )}
            {step === 1 ? (
              <Button
                type="button"
                disabled={!effectivePrimary}
                onClick={() => setStep(2)}
              >
                Próximo
              </Button>
            ) : (
              <Button
                type="button"
                disabled={confirmLoading}
                onClick={async () => {
                  if (onConfirm) {
                    await onConfirm();
                  } else {
                    setOpen(false);
                  }
                }}
              >
                {confirmLoading ? "Salvando..." : onConfirm ? "Salvar" : "Confirmar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
