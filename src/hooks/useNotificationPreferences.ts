import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ApprovalNotifyMode = "ask" | "all" | "none";

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  demandUpdates: boolean;
  teamUpdates: boolean;
  deadlineReminders: boolean;
  adjustmentRequests: boolean;
  mentionNotifications: boolean;
  /**
   * Behaviour when moving a demand into "Aprovação Interna" or "Aprovação do Cliente":
   * - 'ask'  → open dialog to choose recipients (default)
   * - 'all'  → automatically notify every eligible board member
   * - 'none' → do not send extra approval notifications
   */
  approvalNotifyMode: ApprovalNotifyMode;
  /** Whether to also notify the demand creator on approval transitions */
  approvalNotifyIncludeCreator: boolean;
}

const defaultPreferences: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  demandUpdates: true,
  teamUpdates: true,
  deadlineReminders: true,
  adjustmentRequests: true,
  mentionNotifications: true,
  approvalNotifyMode: "ask",
  approvalNotifyIncludeCreator: true,
};

const isApprovalNotifyMode = (value: unknown): value is ApprovalNotifyMode =>
  value === "ask" || value === "all" || value === "none";

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

      if (data?.preference_value) {
        const value = data.preference_value as Record<string, unknown>;
        return {
          ...defaultPreferences,
          emailNotifications: typeof value.emailNotifications === "boolean" ? value.emailNotifications : defaultPreferences.emailNotifications,
          pushNotifications: typeof value.pushNotifications === "boolean" ? value.pushNotifications : defaultPreferences.pushNotifications,
          demandUpdates: typeof value.demandUpdates === "boolean" ? value.demandUpdates : defaultPreferences.demandUpdates,
          teamUpdates: typeof value.teamUpdates === "boolean" ? value.teamUpdates : defaultPreferences.teamUpdates,
          deadlineReminders: typeof value.deadlineReminders === "boolean" ? value.deadlineReminders : defaultPreferences.deadlineReminders,
          adjustmentRequests: typeof value.adjustmentRequests === "boolean" ? value.adjustmentRequests : defaultPreferences.adjustmentRequests,
          mentionNotifications: typeof value.mentionNotifications === "boolean" ? value.mentionNotifications : defaultPreferences.mentionNotifications,
          approvalNotifyMode: isApprovalNotifyMode(value.approvalNotifyMode) ? value.approvalNotifyMode : defaultPreferences.approvalNotifyMode,
          approvalNotifyIncludeCreator: typeof value.approvalNotifyIncludeCreator === "boolean" ? value.approvalNotifyIncludeCreator : defaultPreferences.approvalNotifyIncludeCreator,
        };
      }

      return defaultPreferences;
    },
    enabled: !!user?.id,
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
            preference_value: newPreferences as unknown as Record<string, boolean>,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_preferences").insert([{
          user_id: user.id,
          preference_key: "notification_preferences",
          preference_value: newPreferences as unknown as Record<string, boolean>,
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
