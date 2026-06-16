import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, Bell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useBoardMembers, useBoardRole } from "@/hooks/useBoardMembers";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import {
  useBoardApprovalNotifySetting,
  useUpsertBoardApprovalNotifySetting,
  useDemandApprovalNotifySetting,
} from "@/hooks/useBoardApprovalNotifySettings";
import { notifyApproval, type ApprovalKind } from "@/lib/approvalNotifications";

interface ApprovalNotifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string | null;
  demandTitle: string | undefined;
  demandCreatedBy: string | undefined;
  boardId: string | null | undefined;
  boardName?: string;
  approvalType: ApprovalKind;
}

const INTERNAL_ROLES = new Set(["admin", "moderator"]);
const EXTERNAL_ROLES = new Set(["requester"]);

const roleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Administrador";
    case "moderator": return "Coordenador";
    case "executor": return "Agente";
    case "requester": return "Solicitante";
    default: return role;
  }
};

const roleBadgeClass = (role: string) => {
  switch (role) {
    case "admin": return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/40";
    case "moderator": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40";
    case "executor": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40";
    case "requester": return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40";
    default: return "";
  }
};

export const ApprovalNotifyDialog = React.memo(function ApprovalNotifyDialog({
  open,
  onOpenChange,
  demandId,
  demandTitle,
  demandCreatedBy,
  boardId,
  boardName,
  approvalType,
}: ApprovalNotifyDialogProps) {
  const { user } = useAuth();
  const { data: boardMembers, isLoading: membersLoading } = useBoardMembers(open ? boardId ?? null : null);
  const { data: myBoardRole } = useBoardRole(open ? boardId ?? null : null);
  const { preferences } = useNotificationPreferences();
  const { setting: boardSetting, isLoading: settingLoading } =
    useBoardApprovalNotifySetting(open ? boardId ?? null : null, approvalType);
  const { data: demandSetting, isLoading: demandSettingLoading } =
    useDemandApprovalNotifySetting(open ? demandId ?? null : null, approvalType);
  const upsertBoardSetting = useUpsertBoardApprovalNotifySetting();
  // Per-demand setting takes precedence over the board default.
  const effectiveSetting = demandSetting
    ? {
        mode: demandSetting.mode,
        recipient_ids: demandSetting.recipient_ids ?? [],
        include_creator: demandSetting.include_creator,
      }
    : boardSetting
      ? {
          mode: boardSetting.mode,
          recipient_ids: boardSetting.recipient_ids ?? [],
          include_creator: boardSetting.include_creator,
        }
      : null;

  const canManageBoardDefault = myBoardRole === "admin" || myBoardRole === "moderator";

  const [mode, setMode] = useState<"all" | "manual">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeCreator, setIncludeCreator] = useState(true);
  const [saveAsBoardDefault, setSaveAsBoardDefault] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<"confirm" | "edit">("confirm");

  const allowedRoles = approvalType === "internal" ? INTERNAL_ROLES : EXTERNAL_ROLES;

  const eligibleMembers = useMemo(() => {
    if (!boardMembers) return [];
    return boardMembers.filter(
      (m) => allowedRoles.has(m.role) && m.user_id !== user?.id,
    );
  }, [boardMembers, allowedRoles, user?.id]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return eligibleMembers;
    const q = search.toLowerCase();
    return eligibleMembers.filter((m) => {
      const name = (m.profile?.full_name || "").toLowerCase();
      const email = (m.profile?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [eligibleMembers, search]);

  // Reset state when (re)opening
  useEffect(() => {
    if (open) {
      setSaveAsBoardDefault(false);
      setSearch("");
      setSubmitting(false);
      setHydrated(false);
      setView("confirm");
    }
  }, [open]);

  // Hydrate from per-demand setting, then board setting, then defaults.
  useEffect(() => {
    if (!open || hydrated || settingLoading || demandSettingLoading) return;
    if (effectiveSetting) {
      setMode(effectiveSetting.mode);
      setSelected(new Set(effectiveSetting.recipient_ids ?? []));
      setIncludeCreator(effectiveSetting.include_creator);
      setView("confirm");
    } else {
      setMode("all");
      setSelected(new Set());
      setIncludeCreator(preferences.approvalNotifyIncludeCreator);
      setView("edit");
    }
    setHydrated(true);
  }, [open, hydrated, settingLoading, demandSettingLoading, effectiveSetting, preferences.approvalNotifyIncludeCreator]);

  const toggleMember = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const finalRecipients = useMemo(() => {
    const ids = new Set<string>();
    if (mode === "all") {
      eligibleMembers.forEach((m) => ids.add(m.user_id));
    } else {
      selected.forEach((id) => ids.add(id));
    }
    if (includeCreator && demandCreatedBy && demandCreatedBy !== user?.id) {
      ids.add(demandCreatedBy);
    }
    return Array.from(ids);
  }, [mode, eligibleMembers, selected, includeCreator, demandCreatedBy, user?.id]);

  const approvalLabel =
    approvalType === "internal" ? "Aprovação Interna" : "Aprovação do Cliente";

  const persistBoardDefault = async () => {
    if (!boardId) return;
    await upsertBoardSetting.mutateAsync({
      boardId,
      approvalType,
      recipientIds: mode === "manual" ? Array.from(selected) : [],
      includeCreator,
      mode,
    });
  };


  const handleSkip = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!demandId || !user?.id) return;
    if (finalRecipients.length === 0) {
      toast.error("Selecione ao menos um destinatário ou clique 'Pular'");
      return;
    }
    setSubmitting(true);
    try {
      const { sent } = await notifyApproval({
        demandId,
        demandTitle: demandTitle || "",
        boardName,
        approvalType,
        recipientIds: finalRecipients,
        senderId: user.id,
      });

      if (saveAsBoardDefault && canManageBoardDefault) {
        try {
          await persistBoardDefault();
        } catch (e) {
          console.error(e);
        }
      }

      toast.success(
        sent === 1
          ? "1 pessoa notificada sobre a aprovação"
          : `${sent} pessoas notificadas sobre a aprovação`,
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending approval notifications:", error);
      toast.error("Erro ao enviar notificações");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !submitting) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificar sobre aprovação
          </DialogTitle>
          <DialogDescription>
            A demanda{" "}
            <span className="font-medium text-foreground">
              "{demandTitle || "—"}"
            </span>{" "}
            foi movida para{" "}
            <span className="font-medium text-foreground">{approvalLabel}</span>.
            {view === "confirm" && effectiveSetting
              ? (demandSetting
                  ? " Confirme quem será notificado conforme configurado nesta demanda."
                  : " Confirme quem será notificado pelo padrão do quadro.")
              : effectiveSetting
                ? " Ajuste a lista de destinatários."
                : " Selecione quem deve ser avisado."}
          </DialogDescription>
        </DialogHeader>

        {view === "confirm" && effectiveSetting ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {finalRecipients.length === 1
                    ? "1 pessoa será notificada"
                    : `${finalRecipients.length} pessoas serão notificadas`}
                </p>
                <ScrollArea className="max-h-[260px]">
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : finalRecipients.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum destinatário no padrão atual.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {finalRecipients.map((rid) => {
                        const member = boardMembers?.find((m) => m.user_id === rid);
                        const name = member?.profile?.full_name || member?.profile?.email || "Usuário";
                        const initials = name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase();
                        const isCreator = rid === demandCreatedBy;
                        return (
                          <li key={rid} className="flex items-center gap-3 rounded-md px-2 py-1.5 bg-background">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={member?.profile?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{name}</p>
                              {member?.profile?.job_title && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {member.profile.job_title}
                                </p>
                              )}
                            </div>
                            {member?.role && (
                              <Badge variant="outline" className={`text-[10px] ${roleBadgeClass(member.role)}`}>
                                {roleLabel(member.role)}
                              </Badge>
                            )}
                            {isCreator && !member && (
                              <Badge variant="outline" className="text-[10px]">Criador</Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </ScrollArea>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                {effectiveSetting.mode === "all"
                  ? (demandSetting ? "Esta demanda: todos os elegíveis do quadro." : "Padrão: todos os elegíveis do quadro.")
                  : (demandSetting ? "Esta demanda: lista personalizada." : "Padrão: lista personalizada do quadro.")}
                {effectiveSetting.include_creator && " Inclui o criador da demanda."}
              </p>
            </div>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={submitting}
                className="hover:bg-white hover:text-primary hover:border-primary"
              >
                Pular
              </Button>
              <Button
                variant="outline"
                onClick={() => setView("edit")}
                disabled={submitting}
                className="hover:bg-white hover:text-primary hover:border-primary"
              >
                Alterar seleção
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || finalRecipients.length === 0}
                className="bg-primary text-primary-foreground border border-transparent hover:bg-white hover:text-primary hover:border-primary"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Notificar ({finalRecipients.length})
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as "all" | "manual")}
                className="space-y-2"
              >
                <div className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="all" id="notify-all" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="notify-all" className="cursor-pointer font-medium">
                      Todos os elegíveis do quadro
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {approvalType === "internal"
                        ? "Administradores e Coordenadores deste quadro"
                        : "Solicitantes deste quadro"}
                      {eligibleMembers.length > 0 && ` (${eligibleMembers.length})`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="manual" id="notify-manual" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="notify-manual" className="cursor-pointer font-medium">
                      Selecionar manualmente
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Escolha pessoas específicas da lista abaixo.
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {mode === "manual" && (
                <div className="space-y-2">
                  {eligibleMembers.length > 8 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar membro..."
                        className="pl-8 h-9"
                      />
                    </div>
                  )}

                  <ScrollArea className="h-[200px] rounded-md border">
                    {membersLoading ? (
                      <div className="flex items-center justify-center h-[200px]">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                        Nenhum membro elegível encontrado
                      </div>
                    ) : (
                      <ul className="p-1">
                        {filteredMembers.map((m) => {
                          const checked = selected.has(m.user_id);
                          const initials = (m.profile?.full_name || "?")
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase();
                          return (
                            <li key={m.user_id}>
                              <button
                                type="button"
                                onClick={() => toggleMember(m.user_id)}
                                className="w-full flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors text-left"
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleMember(m.user_id)} />
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={m.profile?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {m.profile?.full_name || m.profile?.email || "Sem nome"}
                                  </p>
                                  {m.profile?.job_title && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {m.profile.job_title}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className={`text-[10px] ${roleBadgeClass(m.role)}`}>
                                  {roleLabel(m.role)}
                                </Badge>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </ScrollArea>
                </div>
              )}

              {demandCreatedBy && demandCreatedBy !== user?.id && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="include-creator" className="cursor-pointer text-sm font-medium">
                      Notificar também o criador da demanda
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Avisa quem abriu a demanda originalmente.
                    </p>
                  </div>
                  <Checkbox
                    id="include-creator"
                    checked={includeCreator}
                    onCheckedChange={(v) => setIncludeCreator(!!v)}
                  />
                </div>
              )}

              {canManageBoardDefault ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-3 bg-muted/20">
                  <Checkbox
                    id="save-board-default"
                    checked={saveAsBoardDefault}
                    onCheckedChange={(v) => setSaveAsBoardDefault(!!v)}
                  />
                  <Label htmlFor="save-board-default" className="cursor-pointer text-xs">
                    Salvar como padrão deste quadro
                    <span className="block text-muted-foreground">
                      Próximas demandas movidas para {approvalLabel.toLowerCase()} virão com essa lista pré-selecionada.
                    </span>
                  </Label>
                </div>
              ) : effectiveSetting ? (
                <p className="text-xs text-muted-foreground px-1">
                  Lista padrão configurada {demandSetting ? "para esta demanda" : "por um administrador do quadro"}.
                </p>
              ) : null}
            </div>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2 flex-wrap">
              {effectiveSetting && (
                <Button
                  variant="outline"
                  onClick={() => setView("confirm")}
                  disabled={submitting}
                  className="hover:bg-white hover:text-primary hover:border-primary"
                >
                  Voltar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={submitting}
                className="hover:bg-white hover:text-primary hover:border-primary"
              >
                Pular
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || upsertBoardSetting.isPending || finalRecipients.length === 0}
                className="bg-primary text-primary-foreground border border-transparent hover:bg-white hover:text-primary hover:border-primary"
              >
                {(submitting || upsertBoardSetting.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Notificar ({finalRecipients.length})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});
