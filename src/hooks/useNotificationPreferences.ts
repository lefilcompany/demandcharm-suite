import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ApprovalNotifyMode = "ask" | "all" | "none";
export type NotificationChannel = "email" | "push" | "inapp";
export type NotificationEventType =
  | "demandAssigned"
  | "demandStatusChanged"
  | "demandComment"
  | "demandMention"
  | "demandAdjustment"
  | "demandApproval"
  | "demandDeadline"
  | "boardMembership"
  | "teamUpdates"
  | "requestApproval"
  | "platformUpdates";

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  "demandAssigned",
  "demandStatusChanged",
  "demandComment",
  "demandMention",
  "demandAdjustment",
  "demandApproval",
  "demandDeadline",
  "boardMembership",
  "teamUpdates",
  "requestApproval",
  "platformUpdates",
];

export type BoardScope = "all" | "assigned_only" | "off";

export interface ChannelPreferences {
  enabled: boolean;
  types: Record<NotificationEventType, boolean>;
}

export interface NotificationPreferences {
  channels: {
    email: ChannelPreferences;
    push: ChannelPreferences;
    inapp: ChannelPreferences;
  };
  /** Escopo padrão para eventos vinculados a um quadro. */
  defaultScope: "all" | "assigned_only";
  /** Overrides por quadro (YouTube-style). */
  boardScopes: Record<string, BoardScope>;
  approvalNotifyMode: ApprovalNotifyMode;
  approvalNotifyIncludeCreator: boolean;
}

const allTypesTrue = (): Record<NotificationEventType, boolean> =>
  NOTIFICATION_EVENT_TYPES.reduce((acc, t) => {
    acc[t] = true;
    return acc;
  }, {} as Record<NotificationEventType, boolean>);

const defaultChannel = (): ChannelPreferences => ({ enabled: true, types: allTypesTrue() });

export const defaultPreferences: NotificationPreferences = {
  channels: {
    email: defaultChannel(),
    push: defaultChannel(),
    inapp: defaultChannel(),
  },
  defaultScope: "assigned_only",
  boardScopes: {},
  approvalNotifyMode: "ask",
  approvalNotifyIncludeCreator: true,
};

const isApprovalNotifyMode = (v: unknown): v is ApprovalNotifyMode =>
  v === "ask" || v === "all" || v === "none";

const isBoardScope = (v: unknown): v is BoardScope =>
  v === "all" || v === "assigned_only" || v === "off";

/** Map legacy flags → new event-type flags. */
function mapLegacyTypes(legacy: Record<string, unknown>): Record<NotificationEventType, boolean> {
  const demandUpdates = legacy.demandUpdates !== false;
  const teamUpdates = legacy.teamUpdates !== false;
  const deadlineReminders = legacy.deadlineReminders !== false;
  const adjustmentRequests = legacy.adjustmentRequests !== false;
  const mentionNotifications = legacy.mentionNotifications !== false;

  return {
    demandAssigned: demandUpdates,
    demandStatusChanged: demandUpdates,
    demandComment: demandUpdates,
    demandMention: mentionNotifications,
    demandAdjustment: adjustmentRequests,
    demandApproval: demandUpdates,
    demandDeadline: deadlineReminders,
    boardMembership: teamUpdates,
    teamUpdates: teamUpdates,
    requestApproval: demandUpdates,
    platformUpdates: true,
  };
}

function parseChannel(raw: unknown): ChannelPreferences {
  if (!raw || typeof raw !== "object") return defaultChannel();
  const obj = raw as Record<string, unknown>;
  const enabled = typeof obj.enabled === "boolean" ? obj.enabled : true;
  const typesRaw = (obj.types && typeof obj.types === "object" ? obj.types : {}) as Record<string, unknown>;
  const types = allTypesTrue();
  for (const t of NOTIFICATION_EVENT_TYPES) {
    if (typeof typesRaw[t] === "boolean") types[t] = typesRaw[t] as boolean;
  }
  return { enabled, types };
}

function parsePreferences(value: Record<string, unknown> | null | undefined): NotificationPreferences {
  if (!value) return defaultPreferences;

  // Novo formato
  if (value.channels && typeof value.channels === "object") {
    const ch = value.channels as Record<string, unknown>;
    const boardScopesRaw = (value.boardScopes && typeof value.boardScopes === "object"
      ? value.boardScopes
      : {}) as Record<string, unknown>;
    const boardScopes: Record<string, BoardScope> = {};
    for (const [k, v] of Object.entries(boardScopesRaw)) {
      if (isBoardScope(v)) boardScopes[k] = v;
    }
    return {
      channels: {
        email: parseChannel(ch.email),
        push: parseChannel(ch.push),
        inapp: parseChannel(ch.inapp),
      },
      defaultScope: value.defaultScope === "all" ? "all" : "assigned_only",
      boardScopes,
      approvalNotifyMode: isApprovalNotifyMode(value.approvalNotifyMode)
        ? value.approvalNotifyMode
        : defaultPreferences.approvalNotifyMode,
      approvalNotifyIncludeCreator:
        typeof value.approvalNotifyIncludeCreator === "boolean"
          ? value.approvalNotifyIncludeCreator
          : defaultPreferences.approvalNotifyIncludeCreator,
    };
  }

  // Formato antigo → migra
  const legacyTypes = mapLegacyTypes(value);
  const emailEnabled = value.emailNotifications !== false;
  const pushEnabled = value.pushNotifications !== false;

  return {
    channels: {
      email: { enabled: emailEnabled, types: { ...legacyTypes } },
      push: { enabled: pushEnabled, types: { ...legacyTypes } },
      inapp: { enabled: true, types: { ...legacyTypes } },
    },
    defaultScope: "assigned_only",
    boardScopes: {},
    approvalNotifyMode: isApprovalNotifyMode(value.approvalNotifyMode)
      ? value.approvalNotifyMode
      : defaultPreferences.approvalNotifyMode,
    approvalNotifyIncludeCreator:
      typeof value.approvalNotifyIncludeCreator === "boolean"
        ? value.approvalNotifyIncludeCreator
        : defaultPreferences.approvalNotifyIncludeCreator,
  };
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return defaultPreferences;
      const { data, error } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", "notification_preferences")
        .maybeSingle();
      if (error) {
        console.error("Error fetching notification preferences:", error);
        return defaultPreferences;
      }
      return parsePreferences(data?.preference_value as Record<string, unknown> | null);
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const updatePreferences = useMutation({
    mutationFn: async (newPreferences: NotificationPreferences) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", user.id)
        .eq("preference_key", "notification_preferences")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_preferences")
          .update({
            preference_value: newPreferences as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_preferences").insert([{
          user_id: user.id,
          preference_key: "notification_preferences",
          preference_value: newPreferences as any,
        }]);
        if (error) throw error;
      }

      return newPreferences;
    },
    onSuccess: (newPreferences) => {
      queryClient.setQueryData(["notification-preferences", user?.id], newPreferences);
    },
  });

  return {
    preferences: preferences ?? defaultPreferences,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    updatePreferencesAsync: updatePreferences.mutateAsync,
    isUpdating: updatePreferences.isPending,
  };
}
