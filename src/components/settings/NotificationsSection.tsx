import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SectionShell } from "./SectionShell";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotificationPreferences, NotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, Mail, Smartphone, Loader2 } from "lucide-react";

export function NotificationsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { preferences, updatePreferences, isLoading } = useNotificationPreferences();
  const {
    isSupported: isPushSupported,
    isEnabled: isPushEnabled,
    isLoading: isPushLoading,
    permissionStatus,
    enablePushNotifications,
    disablePushNotifications,
  } = usePushNotifications();

  const set = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferences({ ...preferences, [key]: value });
    toast.success(t("toast.settingsSaved"));
  };

  return (
    <SectionShell icon={Bell} title="Notificações" description="Como e quando receber alertas">
      {/* Channels */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canais</h4>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="cursor-pointer">E-mail</Label>
              <p className="text-xs text-muted-foreground">Receber e-mails de eventos importantes</p>
            </div>
          </div>
          <Switch checked={preferences.emailNotifications}
            onCheckedChange={(c) => set("emailNotifications", c)} disabled={isLoading} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="cursor-pointer">Push (in-app)</Label>
              <p className="text-xs text-muted-foreground">Notificações dentro da plataforma</p>
            </div>
          </div>
          <Switch checked={preferences.pushNotifications}
            onCheckedChange={(c) => set("pushNotifications", c)} disabled={isLoading} />
        </div>

        {isPushSupported && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-start gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <Label className="font-medium">Notificações do Navegador</Label>
                <p className="text-xs text-muted-foreground">
                  {isPushEnabled ? "Ativas neste dispositivo"
                    : permissionStatus === "denied" ? "Permissão negada. Habilite no navegador."
                    : "Receba notificações mesmo com o navegador minimizado"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isPushEnabled ? (
                <Button variant="outline" size="sm" onClick={disablePushNotifications} disabled={isPushLoading}>
                  {isPushLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Desativar
                </Button>
              ) : (
                <Button size="sm" onClick={enablePushNotifications} disabled={isPushLoading || permissionStatus === "denied"}>
                  {isPushLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Ativar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Types */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipos</h4>

        {[
          { key: "demandUpdates" as const, label: "Atualizações de demandas", desc: "Mudanças de status, comentários, etc." },
          { key: "teamUpdates" as const, label: "Atualizações da equipe", desc: "Novos membros, mudanças no quadro" },
          { key: "deadlineReminders" as const, label: "Lembretes de prazo", desc: "Alertas antes do vencimento" },
          { key: "adjustmentRequests" as const, label: "Solicitações de ajuste", desc: "Quando alguém pedir alterações" },
          { key: "mentionNotifications" as const, label: "Menções", desc: "Quando alguém te mencionar (@)" },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="cursor-pointer">{label}</Label>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch checked={preferences[key]} onCheckedChange={(c) => set(key, c)} disabled={isLoading} />
          </div>
        ))}
      </div>

      <Separator />

      {/* Approvals */}
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aprovações</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Comportamento ao mover uma demanda para Aprovação Interna ou do Cliente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <Label>Ao mover para aprovação</Label>
            <p className="text-xs text-muted-foreground">Padrão para essas mudanças.</p>
          </div>
          <Select
            value={preferences.approvalNotifyMode}
            onValueChange={(value) =>
              updatePreferences({ ...preferences, approvalNotifyMode: value as NotificationPreferences["approvalNotifyMode"] })
            }
            disabled={isLoading}
          >
            <SelectTrigger className="w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ask">Sempre perguntar (recomendado)</SelectItem>
              <SelectItem value="all">Notificar todos os elegíveis</SelectItem>
              <SelectItem value="none">Não notificar ninguém</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer">Incluir criador da demanda</Label>
            <p className="text-xs text-muted-foreground">Notifica também quem criou a demanda.</p>
          </div>
          <Switch
            checked={preferences.approvalNotifyIncludeCreator}
            onCheckedChange={(c) => set("approvalNotifyIncludeCreator", c)}
            disabled={isLoading}
          />
        </div>
      </div>
    </SectionShell>
  );
}
