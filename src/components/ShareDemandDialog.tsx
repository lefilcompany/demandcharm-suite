import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useShareToken, useCreateShareToken, useRevokeShareToken, useUpdateShareTokenAutoJoin } from "@/hooks/useShareDemand";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { Share2, Copy, Check, Link, Trash2, Loader2, Calendar, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, addHours, addWeeks, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ShareDemandDialogProps {
  demandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExpirationOption = "never" | "1h" | "24h" | "7d" | "30d" | "custom";

export function ShareDemandDialog({ demandId, open, onOpenChange }: ShareDemandDialogProps) {
  const [copied, setCopied] = useState(false);
  const [expiration, setExpiration] = useState<ExpirationOption>("never");
  const [customDate, setCustomDate] = useState("");
  const [autoJoinBoard, setAutoJoinBoard] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const { user } = useAuth();

  const { data: existingToken, isLoading: isLoadingToken, refetch } = useShareToken(demandId);
  const createToken = useCreateShareToken();
  const revokeToken = useRevokeShareToken();
  const updateAutoJoin = useUpdateShareTokenAutoJoin();
  const { data: boardRole } = useBoardRole(boardId);
  const canManageAutoJoin =
    boardRole === "admin" || boardRole === "moderator" || isTeamAdmin;

  useEffect(() => {
    if (!open || !demandId) return;
    let cancelled = false;
    (async () => {
      const { data: d } = await supabase
        .from("demands")
        .select("board_id, team_id")
        .eq("id", demandId)
        .maybeSingle();
      if (cancelled) return;
      const bId = (d?.board_id as string) ?? null;
      const tId = (d?.team_id as string) ?? null;
      setBoardId(bId);
      setTeamId(tId);

      if (tId && user?.id) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("role")
          .eq("team_id", tId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const r = tm?.role;
        setIsTeamAdmin(r === "admin" || r === "moderator");
      } else {
        setIsTeamAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, demandId, user?.id]);


  const shareUrl = existingToken
    ? `${window.location.origin}/shared/${existingToken.token}`
    : null;

  const getExpirationDate = (): string | null => {
    const now = new Date();
    switch (expiration) {
      case "1h": return addHours(now, 1).toISOString();
      case "24h": return addDays(now, 1).toISOString();
      case "7d": return addWeeks(now, 1).toISOString();
      case "30d": return addMonths(now, 1).toISOString();
      case "custom": return customDate ? new Date(customDate).toISOString() : null;
      default: return null;
    }
  };

  const handleCreateLink = async () => {
    if (!user) return;
    try {
      const expiresAt = getExpirationDate();
      await createToken.mutateAsync({
        demandId,
        userId: user.id,
        expiresAt,
        autoJoinBoard: canManageAutoJoin ? autoJoinBoard : false,
      });
      toast.success("Link de compartilhamento criado!");
      setExpiration("never");
      setCustomDate("");
      setAutoJoinBoard(false);
    } catch {
      toast.error("Erro ao criar link de compartilhamento");
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleRevokeLink = async () => {
    if (!existingToken) return;
    try {
      await revokeToken.mutateAsync(existingToken.id);
      toast.success("Link de compartilhamento revogado!");
      await refetch();
    } catch {
      toast.error("Erro ao revogar link");
    }
  };

  const handleToggleExistingAutoJoin = async (checked: boolean) => {
    if (!existingToken) return;
    try {
      await updateAutoJoin.mutateAsync({ tokenId: existingToken.id, autoJoinBoard: checked });
      toast.success(checked ? "Auto-inclusão no quadro ativada" : "Auto-inclusão no quadro desativada");
      await refetch();
    } catch {
      toast.error("Erro ao atualizar opção");
    }
  };

  const formatExpirationDate = (date: string | null) => {
    if (!date) return "Nunca expira";
    const expirationDate = new Date(date);
    if (expirationDate < new Date()) return "Expirado";
    return format(expirationDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const isExpired = existingToken?.expires_at && new Date(existingToken.expires_at) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar Demanda
          </DialogTitle>
          <DialogDescription>
            Crie um link público para compartilhar esta demanda. Quem tiver o link poderá visualizar,
            mas não editar a demanda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoadingToken ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : existingToken ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link className={`h-4 w-4 flex-shrink-0 ${isExpired ? 'text-destructive' : 'text-green-600'}`} />
                  <span className={`text-sm font-medium ${isExpired ? 'text-destructive' : 'text-green-600'}`}>
                    {isExpired ? 'Link expirado' : 'Link ativo'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatExpirationDate(existingToken.expires_at)}
                </div>
              </div>

              <div className="flex gap-2">
                <Input value={shareUrl || ""} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyLink} disabled={!!isExpired}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {canManageAutoJoin && (
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <UserPlus className="h-4 w-4" />
                      Adicionar ao quadro como Agente
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quem acessar o link e já pertencer à equipe entra no quadro automaticamente.
                    </p>
                  </div>
                  <Switch
                    checked={!!existingToken.auto_join_board}
                    onCheckedChange={handleToggleExistingAutoJoin}
                    disabled={updateAutoJoin.isPending || !!isExpired}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="default" className="flex-1" onClick={handleCopyLink} disabled={!!isExpired}>
                  {copied ? (
                    <><Check className="mr-2 h-4 w-4" />Copiado!</>
                  ) : (
                    <><Copy className="mr-2 h-4 w-4" />Copiar Link</>
                  )}
                </Button>
                <Button variant="destructive" size="icon" onClick={handleRevokeLink} disabled={revokeToken.isPending}>
                  {revokeToken.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {isExpired
                  ? "Este link expirou. Revogue-o e crie um novo link para compartilhar."
                  : "Ao revogar o link, ele deixará de funcionar e quem tentar acessá-lo verá uma mensagem de erro."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Qualquer pessoa com o link pode visualizar
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Inclui descrição, status e comentários
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Não é possível editar sem login
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    Você pode revogar o link a qualquer momento
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Expiração do link
                </Label>
                <Select value={expiration} onValueChange={(v) => setExpiration(v as ExpirationOption)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a expiração" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Nunca expira</SelectItem>
                    <SelectItem value="1h">1 hora</SelectItem>
                    <SelectItem value="24h">24 horas</SelectItem>
                    <SelectItem value="7d">7 dias</SelectItem>
                    <SelectItem value="30d">30 dias</SelectItem>
                    <SelectItem value="custom">Data personalizada</SelectItem>
                  </SelectContent>
                </Select>

                {expiration === "custom" && (
                  <Input
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="mt-2"
                  />
                )}
              </div>

              {canManageAutoJoin && (
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <UserPlus className="h-4 w-4" />
                      Adicionar ao quadro como Agente
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quem acessar o link e já pertencer à equipe deste quadro será adicionado automaticamente como Agente.
                    </p>
                  </div>
                  <Switch checked={autoJoinBoard} onCheckedChange={setAutoJoinBoard} />
                </div>
              )}

              <Button
                onClick={handleCreateLink}
                disabled={createToken.isPending || (expiration === "custom" && !customDate)}
                className="w-full"
              >
                {createToken.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
                ) : (
                  <><Link className="mr-2 h-4 w-4" />Criar Link de Compartilhamento</>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
