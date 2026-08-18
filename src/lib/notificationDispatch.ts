import { supabase } from "@/integrations/supabase/client";
import {
  defaultPreferences,
  NotificationChannel,
  NotificationEventType,
  NotificationPreferences,
} from "@/hooks/useNotificationPreferences";

// Re-parser copiado do hook para uso fora do React
function parsePreferencesValue(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object") return defaultPreferences;
  const v = value as Record<string, unknown>;

  if (v.channels && typeof v.channels === "object") {
    const ch = v.channels as Record<string, any>;
    const readChannel = (c: any) => {
      if (!c || typeof c !== "object") return defaultPreferences.channels.email;
      const types = { ...defaultPreferences.channels.email.types };
      const tRaw = c.types || {};
      for (const k of Object.keys(types)) {
        if (typeof tRaw[k] === "boolean") (types as any)[k] = tRaw[k];
      }
      return { enabled: c.enabled !== false, types };
    };
    const boardScopes: Record<string, "all" | "assigned_only" | "off"> = {};
    const bs = (v.boardScopes || {}) as Record<string, unknown>;
    for (const [k, val] of Object.entries(bs)) {
      if (val === "all" || val === "assigned_only" || val === "off") boardScopes[k] = val;
    }
    return {
      channels: {
        email: readChannel(ch.email),
        push: readChannel(ch.push),
        inapp: readChannel(ch.inapp),
      },
      defaultScope: v.defaultScope === "all" ? "all" : "assigned_only",
      boardScopes,
      approvalNotifyMode:
        v.approvalNotifyMode === "all" || v.approvalNotifyMode === "none" ? v.approvalNotifyMode : "ask",
      approvalNotifyIncludeCreator: v.approvalNotifyIncludeCreator !== false,
    };
  }

  // legacy
  const legacyDemand = v.demandUpdates !== false;
  const legacyTeam = v.teamUpdates !== false;
  const legacyDeadline = v.deadlineReminders !== false;
  const legacyAdj = v.adjustmentRequests !== false;
  const legacyMention = v.mentionNotifications !== false;
  const emailEnabled = v.emailNotifications !== false;
  const pushEnabled = v.pushNotifications !== false;
  const types: Record<NotificationEventType, boolean> = {
    demandAssigned: legacyDemand,
    demandStatusChanged: legacyDemand,
    demandComment: legacyDemand,
    demandMention: legacyMention,
    demandAdjustment: legacyAdj,
    demandApproval: legacyDemand,
    demandDeadline: legacyDeadline,
    boardMembership: legacyTeam,
    teamUpdates: legacyTeam,
    requestApproval: legacyDemand,
    productUpdates: true,
  };
  return {
    channels: {
      email: { enabled: emailEnabled, types: { ...types } },
      push: { enabled: pushEnabled, types: { ...types } },
      inapp: { enabled: true, types: { ...types } },
    },
    defaultScope: "assigned_only",
    boardScopes: {},
    approvalNotifyMode: "ask",
    approvalNotifyIncludeCreator: true,
  };
}

/** Se o evento é de escopo de quadro (respeita defaultScope/boardScopes). */
const BOARD_SCOPED_TYPES: Record<NotificationEventType, boolean> = {
  demandAssigned: false, // atribuição direta sempre notifica o alvo
  demandStatusChanged: true,
  demandComment: true,
  demandMention: false, // menção explícita sempre passa
  demandAdjustment: true,
  demandApproval: true,
  demandDeadline: false, // deadlines já são só para envolvidos
  boardMembership: false, // é sobre você mesmo
  teamUpdates: false,
  requestApproval: false,
  productUpdates: false, // anúncio global, não depende de quadro
};

export interface DispatchContext {
  channel: NotificationChannel;
  type: NotificationEventType;
  boardId?: string;
  /** Se o destinatário é responsável/acompanhante da demanda em questão. */
  isUserAssigned?: boolean;
}

export function shouldNotifyUser(
  prefs: NotificationPreferences,
  ctx: DispatchContext,
): boolean {
  const channel = prefs.channels[ctx.channel];
  if (!channel || channel.enabled === false) return false;
  if (channel.types[ctx.type] === false) return false;

  if (BOARD_SCOPED_TYPES[ctx.type] && ctx.boardId) {
    const scope = prefs.boardScopes[ctx.boardId] ?? prefs.defaultScope;
    if (scope === "off") return false;
    if (scope === "assigned_only" && !ctx.isUserAssigned) return false;
  }

  return true;
}

/**
 * Busca preferências (formato novo ou legado) para vários usuários de uma vez.
 * Retorna Map<userId, NotificationPreferences>. Falhas → default (permissivo).
 */
export async function fetchPreferencesForUsers(
  userIds: string[],
): Promise<Map<string, NotificationPreferences>> {
  const map = new Map<string, NotificationPreferences>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return map;

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("user_id, preference_value")
      .in("user_id", unique)
      .eq("preference_key", "notification_preferences");
    if (error) {
      console.warn("[notificationDispatch] prefs lookup failed, defaulting all:", error);
    } else if (data) {
      for (const row of data as Array<{ user_id: string; preference_value: unknown }>) {
        map.set(row.user_id, parsePreferencesValue(row.preference_value));
      }
    }
  } catch (err) {
    console.warn("[notificationDispatch] prefs lookup exception:", err);
  }

  for (const id of unique) {
    if (!map.has(id)) map.set(id, defaultPreferences);
  }
  return map;
}

/** Busca os user_ids atribuídos (responsável + acompanhantes) de uma demanda. */
export async function fetchDemandAssigneeIds(demandId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("demand_assignees")
      .select("user_id")
      .eq("demand_id", demandId);
    if (error) {
      console.warn("[notificationDispatch] assignees lookup failed:", error);
      return new Set();
    }
    return new Set((data || []).map((r) => r.user_id));
  } catch (err) {
    console.warn("[notificationDispatch] assignees lookup exception:", err);
    return new Set();
  }
}

/**
 * Filtra recipientes por canal, consultando prefs + assignees uma única vez.
 * Retorna 3 arrays (email, push, inapp) com quem deve receber cada canal.
 */
export async function filterRecipientsByChannel({
  recipientIds,
  type,
  boardId,
  demandId,
}: {
  recipientIds: string[];
  type: NotificationEventType;
  boardId?: string;
  demandId?: string;
}): Promise<{
  email: string[];
  push: string[];
  inapp: string[];
}> {
  const unique = Array.from(new Set(recipientIds.filter(Boolean)));
  if (unique.length === 0) return { email: [], push: [], inapp: [] };

  const [prefsMap, assignees] = await Promise.all([
    fetchPreferencesForUsers(unique),
    demandId && BOARD_SCOPED_TYPES[type] ? fetchDemandAssigneeIds(demandId) : Promise.resolve(new Set<string>()),
  ]);

  const email: string[] = [];
  const push: string[] = [];
  const inapp: string[] = [];

  for (const id of unique) {
    const prefs = prefsMap.get(id) ?? defaultPreferences;
    const isUserAssigned = assignees.has(id);
    const ctxBase = { type, boardId, isUserAssigned };
    if (shouldNotifyUser(prefs, { ...ctxBase, channel: "email" })) email.push(id);
    if (shouldNotifyUser(prefs, { ...ctxBase, channel: "push" })) push.push(id);
    if (shouldNotifyUser(prefs, { ...ctxBase, channel: "inapp" })) inapp.push(id);
  }

  return { email, push, inapp };
}
