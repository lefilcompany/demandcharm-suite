import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SectionShell } from "./SectionShell";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useNotificationPreferences,
  NotificationPreferences,
  NotificationChannel,
  NotificationEventType,
} from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Bell,
  Mail,
  Smartphone,
  Loader2,
  MonitorSmartphone,
  ChevronDown,
} from "lucide-react";
import { BoardScopeList } from "./BoardScopeList";

interface EventTypeMeta {
  key: NotificationEventType;
  label: string;
  desc: string;
}

const EVENT_TYPES: EventTypeMeta[] = [
  { key: "demandAssigned", label: "Atribuições em demandas", desc: "Quando alguém te define como responsável ou acompanhante." },
  { key: "demandStatusChanged", label: "Mudanças de status", desc: "Quando uma demanda muda de coluna/estágio no quadro." },
  { key: "demandComment", label: "Comentários e mensagens", desc: "Novas mensagens no chat de uma demanda." },
  { key: "demandMention", label: "Menções (@)", desc: "Quando alguém te menciona diretamente." },
  { key: "demandAdjustment", label: "Solicitações de ajuste", desc: "Quando um ajuste (interno ou do cliente) é solicitado." },
  { key: "demandApproval", label: "Aprovações pendentes", desc: "Quando uma demanda entra em aprovação interna ou do cliente." },
  { key: "demandDeadline", label: "Lembretes de prazo", desc: "Alertas antes do vencimento ou de prazo vencido." },
  { key: "boardMembership", label: "Alterações em quadros", desc: "Quando você é adicionado, removido ou tem seu cargo alterado." },
  { key: "teamUpdates", label: "Atualizações da equipe", desc: "Novos membros e mudanças gerais da equipe." },
  { key: "requestApproval", label: "Solicitações de demanda", desc: "Status de solicitações que você criou ou revisa." },
  { key: "platformUpdates", label: "Novidades da plataforma", desc: "Novas funcionalidades, melhorias e lançamentos do SoMA+." },
];

interface ChannelBlockProps {
  channel: NotificationChannel;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  preferences: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
  disabled?: boolean;
  extra?: React.ReactNode;
}

function ChannelBlock({
  channel,
  icon: Icon,
  title,
  description,
  preferences,
  onChange,
  disabled,
  extra,
}: ChannelBlockProps) {
  const state = preferences.channels[channel];
  const visibleEventTypes = EVENT_TYPES.filter(
    ({ key }) => key !== "platformUpdates" || channel !== "push",
  );

  const setEnabled = (v: boolean) => {
    onChange({
      ...preferences,
      channels: {
        ...preferences.channels,
        [channel]: { ...state, enabled: v },
      },
    });
    toast.success("Canal atualizado");
  };

  const setType = (type: NotificationEventType, v: boolean) => {
    onChange({
      ...preferences,
      channels: {
        ...preferences.channels,
        [channel]: {
          ...state,
          types: { ...state.types, [type]: v },
        },
      },
    });
  };

  const [open, setOpen] = useState<boolean>(state.enabled);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 p-3">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-md hover:bg-muted/40 transition-colors -m-1 p-1"
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <Label className="text-sm font-medium block cursor-pointer">{title}</Label>
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <Switch
          checked={state.enabled}
          onCheckedChange={(v) => {
            setEnabled(v);
            if (v) setOpen(true);
          }}
          disabled={disabled}
        />
      </div>

      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-3">
          {extra}
          <Separator />
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tipos que você recebe por este canal
            </p>
            {visibleEventTypes.map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-sm cursor-pointer">{label}</Label>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={state.types[key]}
                  onCheckedChange={(c) => setType(key, c)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NotificationsSection() {
  const { t } = useTranslation();
  const { preferences, updatePreferences, isLoading } = useNotificationPreferences();
  const {
    isSupported: isPushSupported,
    isEnabled: isPushEnabled,
    isLoading: isPushLoading,
    permissionStatus,
    enablePushNotifications,
    disablePushNotifications,
  } = usePushNotifications();

  const change = (next: NotificationPreferences) => {
    updatePreferences(next);
  };

  return (
    <SectionShell icon={Bell} title="Notificações" description="Como, quando e sobre o quê receber alertas">
      {/* Escopo */}
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Escopo padrão
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Define, por padrão, para quais demandas dos seus quadros você recebe notificações.
            Pode ser personalizado por quadro logo abaixo.
          </p>
        </div>

        <RadioGroup
          value={preferences.defaultScope}
          onValueChange={(v) => {
            change({ ...preferences, defaultScope: v as "all" | "assigned_only" });
            toast.success(t("toast.settingsSaved"));
          }}
          className="space-y-2"
        >
          <label className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 cursor-pointer">
            <RadioGroupItem value="assigned_only" className="mt-0.5" />
            <div className="min-w-0">
              <Label className="text-sm font-medium cursor-pointer">
                Apenas demandas em que sou responsável ou acompanhante
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Recomendado. Você não recebe eventos de demandas de outros membros.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-md border bg-muted/20 p-3 cursor-pointer">
            <RadioGroupItem value="all" className="mt-0.5" />
            <div className="min-w-0">
              <Label className="text-sm font-medium cursor-pointer">
                Todas as demandas dos meus quadros
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Você é notificado de qualquer movimentação nos quadros em que participa.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <Separator />

      {/* Canais */}
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Canais
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Ative um canal e escolha quais tipos de evento você quer receber por ele.
          </p>
        </div>

        <ChannelBlock
          channel="email"
          icon={Mail}
          title="E-mail"
          description="Envio para o e-mail cadastrado"
          preferences={preferences}
          onChange={change}
          disabled={isLoading}
        />

        <ChannelBlock
          channel="push"
          icon={Smartphone}
          title="Push (navegador / celular)"
          description="Notificações push via Firebase"
          preferences={preferences}
          onChange={change}
          disabled={isLoading}
          extra={
            isPushSupported ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <Label className="text-sm font-medium">Notificações do Navegador</Label>
                    <p className="text-xs text-muted-foreground">
                      {isPushEnabled
                        ? "Ativas neste dispositivo"
                        : permissionStatus === "denied"
                        ? "Permissão negada. Habilite no navegador."
                        : "Ative para receber pushs mesmo com o app fechado."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isPushEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disablePushNotifications}
                      disabled={isPushLoading}
                    >
                      {isPushLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Desativar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={enablePushNotifications}
                      disabled={isPushLoading || permissionStatus === "denied"}
                    >
                      {isPushLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Ativar
                    </Button>
                  )}
                </div>
              </div>
            ) : null
          }
        />

        <ChannelBlock
          channel="inapp"
          icon={Bell}
          title="Notificações internas"
          description="Sino de notificações dentro da plataforma"
          preferences={preferences}
          onChange={change}
          disabled={isLoading}
        />
      </div>

      <Separator />

      {/* Por quadro */}
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preferência por quadro
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Sobrescreve o escopo padrão para um quadro específico. Estilo YouTube:
            <span className="font-medium"> Todas</span>, <span className="font-medium">Apenas as minhas</span> ou{" "}
            <span className="font-medium">Silenciar</span>.
          </p>
        </div>
        <BoardScopeList preferences={preferences} onChange={change} disabled={isLoading} />
      </div>

      <Separator />

      {/* Aprovações (preservado) */}
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
              change({
                ...preferences,
                approvalNotifyMode: value as NotificationPreferences["approvalNotifyMode"],
              })
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
            onCheckedChange={(c) =>
              change({ ...preferences, approvalNotifyIncludeCreator: c })
            }
            disabled={isLoading}
          />
        </div>
      </div>
    </SectionShell>
  );
}
