import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DashboardWidgets {
  aiInsights: boolean;
  productivitySection: boolean;
  demandsSection: boolean;
  memberAnalysis: boolean;
  recentActivities: boolean;
}

export const DEFAULT_WIDGETS: DashboardWidgets = {
  aiInsights: true,
  productivitySection: true,
  demandsSection: true,
  memberAnalysis: true,
  recentActivities: true,
};

const PREFERENCE_KEY = "dashboard_widgets";

export function useDashboardWidgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: widgets, isLoading } = useQuery({
    queryKey: ["user-preferences", PREFERENCE_KEY, user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_WIDGETS;

      const { data, error } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", PREFERENCE_KEY)
        .maybeSingle();

      if (error) {
        console.error("Error fetching dashboard preferences:", error);
        return DEFAULT_WIDGETS;
      }

      if (!data) return DEFAULT_WIDGETS;

      const storedValue = data.preference_value as unknown as Partial<DashboardWidgets>;
      return { ...DEFAULT_WIDGETS, ...storedValue };
    },
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: async (newWidgets: DashboardWidgets) => {
      if (!user) throw new Error("User not authenticated");

      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", user.id)
        .eq("preference_key", PREFERENCE_KEY)
        .maybeSingle();

      const jsonValue = JSON.parse(JSON.stringify(newWidgets));

      if (existing) {
        const { error } = await supabase
          .from("user_preferences")
          .update({ preference_value: jsonValue })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_preferences")
          .insert([{
            user_id: user.id,
            preference_key: PREFERENCE_KEY,
            preference_value: jsonValue,
          }]);
        if (error) throw error;
      }

      return newWidgets;
    },
    onSuccess: (newWidgets) => {
      queryClient.setQueryData(
        ["user-preferences", PREFERENCE_KEY, user?.id],
        newWidgets
      );
    },
  });

  const setWidgets = (newWidgets: DashboardWidgets) => {
    mutation.mutate(newWidgets);
  };

  return {
    widgets: widgets ?? DEFAULT_WIDGETS,
    setWidgets,
    isLoading,
    isSaving: mutation.isPending,
  };
}
