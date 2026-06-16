import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShieldCheck, Shield, User as UserIcon, Users, Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { ApprovalNotificationsModal } from "@/components/ApprovalNotificationsModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  demandId: string;
  boardId: string | null | undefined;
  canEdit: boolean;
}

const roleConfig: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  admin: { label: "Administrador", badge: "bg-red-100 text-red-800", icon: <ShieldCheck className="h-3 w-3" /> },
  moderator: { label: "Coordenador", badge: "bg-blue-100 text-blue-800", icon: <Shield className="h-3 w-3" /> },
  requester: { label: "Solicitante", badge: "bg-purple-100 text-purple-800", icon: <UserIcon className="h-3 w-3" /> },
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export function DemandApprovalNotifySection({ demandId, boardId, canEdit }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [internalIds, setInternalIds] = useState<string[]>([]);
  const [externalIds, setExternalIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["demand-approval-notify", demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_approval_notify_settings" as any)
        .select("approval_type, recipient_ids")
        .eq("demand_id", demandId);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Detect which approval stages exist on this board
  const { data: availableKinds } = useQuery({
    queryKey: ["board-approval-stages", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_statuses")
        .select("adjustment_type, is_active")
        .eq("board_id", boardId as string)
        .eq("is_active", true);
      if (error) throw error;
      const kinds = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.adjustment_type === "internal") kinds.add("internal");
        if (r.adjustment_type === "external") kinds.add("external");
      });
      return kinds;
    },
  });
  const hasInternal = availableKinds?.has("internal") ?? true;
  const hasExternal = availableKinds?.has("external") ?? true;

  const initialInternal = useMemo(
    () => (settings?.find((s: any) => s.approval_type === "internal")?.recipient_ids as string[]) || [],
    [settings],
  );
  const initialExternal = useMemo(
    () => (settings?.find((s: any) => s.approval_type === "external")?.recipient_ids as string[]) || [],
    [settings],
  );

  useEffect(() => {
    if (!editing) {
      setInternalIds(initialInternal);
      setExternalIds(initialExternal);
    }
  }, [initialInternal, initialExternal, editing]);

  const { data: members } = useBoardMembers(boardId ?? null);

  const internalMembers = useMemo(
    () => (members || []).filter((m) => initialInternal.includes(m.user_id)),
    [members, initialInternal],
  );
  const externalMembers = useMemo(
    () => (members || []).filter((m) => initialExternal.includes(m.user_id)),
    [members, initialExternal],
  );

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Upsert internal
      for (const type of ["internal", "external"] as const) {
        const ids = type === "internal" ? internalIds : externalIds;
        if (ids.length > 0) {
          const { error } = await supabase
            .from("demand_approval_notify_settings" as any)
            .upsert(
              {
                demand_id: demandId,
                approval_type: type,
                mode: "manual",
                recipient_ids: ids,
                include_creator: true,
                updated_by: user.id,
                created_by: user.id,
              },
              { onConflict: "demand_id,approval_type" },
            );
          if (error) throw error;
        } else {
          // No recipients => delete the row to revert to default
          const { error } = await supabase
            .from("demand_approval_notify_settings" as any)
            .delete()
            .eq("demand_id", demandId)
            .eq("approval_type", type);
          if (error) throw error;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["demand-approval-notify", demandId] });
      toast.success("Notificações de aprovação atualizadas");
      setEditing(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const renderRecipients = (list: typeof internalMembers, fallback: string) => {
    if (list.length === 0) {
      return <span className="text-xs text-muted-foreground italic">{fallback}</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {list.slice(0, 3).map((m) => {
          const config = roleConfig[m.role] || roleConfig.requester;
          return (
            <div
              key={m.id}
              className="flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full border border-border bg-card"
              title={`${m.profile?.full_name} • ${config.label}`}
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={m.profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="text-[8px]">{getInitials(m.profile?.full_name || "?")}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-medium truncate max-w-[100px]">
                {m.profile?.full_name?.split(" ")[0]}
              </span>
            </div>
          );
        })}
        {list.length > 3 && (
          <span className="text-[11px] text-muted-foreground">+{list.length - 3}</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground whitespace-nowrap">Notificações de aprovação:</span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
        {hasInternal && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Interna:</span>
            {renderRecipients(internalMembers, "Padrão (Administradores/Coord.)")}
          </div>
        )}
        {hasExternal && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Cliente:</span>
            {renderRecipients(externalMembers, "Padrão (Solicitantes)")}
          </div>
        )}
        {!hasInternal && !hasExternal && (
          <span className="text-xs text-muted-foreground italic">
            Este quadro não possui etapas de aprovação configuradas.
          </span>
        )}
        {canEdit && (hasInternal || hasExternal) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setEditing(true)}
          >
            Editar
          </Button>
        )}
      </div>

      <ApprovalNotificationsModal
        boardId={boardId}
        internalIds={internalIds}
        externalIds={externalIds}
        onChangeInternal={setInternalIds}
        onChangeExternal={setExternalIds}
        open={editing}
        onOpenChange={setEditing}
        onSave={handleSave}
        saving={saving}
        hideTrigger
      />
    </div>
  );
}
