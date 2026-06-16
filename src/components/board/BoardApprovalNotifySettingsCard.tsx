import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import {
  useBoardApprovalNotifySettings,
  useUpsertBoardApprovalNotifySetting,
} from "@/hooks/useBoardApprovalNotifySettings";
import type { ApprovalKind } from "@/lib/approvalNotifications";

interface Props {
  boardId: string;
}

const INTERNAL_ROLES = new Set(["admin", "moderator"]);
const EXTERNAL_ROLES = new Set(["requester"]);

const roleLabel = (r: string) =>
  r === "admin" ? "Administrador"
  : r === "moderator" ? "Coordenador"
  : r === "executor" ? "Agente"
  : r === "requester" ? "Solicitante"
  : r;

const roleBadgeClass = (r: string) =>
  r === "admin" ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/40"
  : r === "moderator" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40"
  : r === "executor" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
  : r === "requester" ? "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40"
  : "";

function ApprovalEditor({
  boardId,
  approvalType,
}: {
  boardId: string;
  approvalType: ApprovalKind;
}) {
  const { data: members } = useBoardMembers(boardId);
  const { data: settings, isLoading } = useBoardApprovalNotifySettings(boardId);
  const upsert = useUpsertBoardApprovalNotifySetting();

  const setting = settings?.find((s) => s.approval_type === approvalType);

  const allowed = approvalType === "internal" ? INTERNAL_ROLES : EXTERNAL_ROLES;
  const eligible = useMemo(
    () => (members || []).filter((m) => allowed.has(m.role)),
    [members, allowed],
  );

  const [mode, setMode] = useState<"all" | "manual">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeCreator, setIncludeCreator] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (setting) {
      setMode(setting.mode);
      setSelected(new Set(setting.recipient_ids ?? []));
      setIncludeCreator(setting.include_creator);
    } else {
      setMode("all");
      setSelected(new Set());
      setIncludeCreator(true);
    }
  }, [setting?.id, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        boardId,
        approvalType,
        recipientIds: mode === "manual" ? Array.from(selected) : [],
        includeCreator,
        mode,
      });
      toast.success("Configuração salva");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar");
    }
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "all" | "manual")} className="space-y-2">
        <div className="flex items-start gap-2 rounded-md border p-3">
          <RadioGroupItem value="all" id={`${approvalType}-all`} className="mt-0.5" />
          <div>
            <Label htmlFor={`${approvalType}-all`} className="cursor-pointer font-medium">
              Todos os elegíveis do quadro ({eligible.length})
            </Label>
            <p className="text-xs text-muted-foreground">
              {approvalType === "internal" ? "Administradores e Coordenadores" : "Solicitantes"} deste quadro.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border p-3">
          <RadioGroupItem value="manual" id={`${approvalType}-manual`} className="mt-0.5" />
          <div>
            <Label htmlFor={`${approvalType}-manual`} className="cursor-pointer font-medium">
              Selecionar pessoas específicas
            </Label>
            <p className="text-xs text-muted-foreground">Escolha abaixo quem será notificado por padrão.</p>
          </div>
        </div>
      </RadioGroup>

      {mode === "manual" && (
        <ScrollArea className="h-[240px] rounded-md border">
          {eligible.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
              Nenhum membro elegível neste quadro
            </div>
          ) : (
            <ul className="p-1">
              {eligible.map((m) => {
                const checked = selected.has(m.user_id);
                const initials = (m.profile?.full_name || "?")
                  .split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
                return (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.user_id)}
                      className="w-full flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 text-left"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(m.user_id)} />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.profile?.full_name || m.profile?.email || "Sem nome"}
                        </p>
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
      )}

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor={`${approvalType}-creator`} className="cursor-pointer text-sm font-medium">
            Notificar também o criador da demanda
          </Label>
          <p className="text-xs text-muted-foreground">Avisa quem abriu a demanda originalmente.</p>
        </div>
        <Checkbox
          id={`${approvalType}-creator`}
          checked={includeCreator}
          onCheckedChange={(v) => setIncludeCreator(!!v)}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}

export function BoardApprovalNotifySettingsCard({ boardId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" />
          Notificações de aprovação
        </CardTitle>
        <CardDescription>
          Defina quem deve ser notificado por padrão quando uma demanda for movida para Aprovação Interna ou Aprovação do Cliente. A lista virá pré-selecionada no modal exibido a quem mover a demanda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="internal">
          <TabsList className="mb-4">
            <TabsTrigger value="internal">Aprovação Interna</TabsTrigger>
            <TabsTrigger value="external">Aprovação do Cliente</TabsTrigger>
          </TabsList>
          <TabsContent value="internal">
            <ApprovalEditor boardId={boardId} approvalType="internal" />
          </TabsContent>
          <TabsContent value="external">
            <ApprovalEditor boardId={boardId} approvalType="external" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
