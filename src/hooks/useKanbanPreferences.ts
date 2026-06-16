import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface KanbanPreferences {
  defaultColumnsOpen: boolean; // true = all open, false = all closed
}

export const DEFAULT_KANBAN_PREFERENCES: KanbanPreferences = {
  defaultColumnsOpen: false, // By default, columns start closed
};

const PREFERENCE_KEY = "kanban_preferences";

export function useKanbanPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["user-preferences", PREFERENCE_KEY, user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_KANBAN_PREFERENCES;

      const { data, error } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", PREFERENCE_KEY)
        .maybeSingle();

      if (error) {
        console.error("Error fetching kanban preferences:", error);
        return DEFAULT_KANBAN_PREFERENCES;
      }

      if (!data) return DEFAULT_KANBAN_PREFERENCES;

      // Merge with defaults to ensure all keys exist
      const storedValue = data.preference_value as unknown as Partial<KanbanPreferences>;
      return { ...DEFAULT_KANBAN_PREFERENCES, ...storedValue };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const mutation = useMutation({
    mutationFn: async (newPreferences: KanbanPreferences) => {
      if (!user) throw new Error("User not authenticated");

      // Check if preference exists
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", user.id)
        .eq("preference_key", PREFERENCE_KEY)
        .maybeSingle();

      const jsonValue = JSON.parse(JSON.stringify(newPreferences));

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("user_preferences")
          .update({ preference_value: jsonValue })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("user_preferences")
          .insert([{
            user_id: user.id,
            preference_key: PREFERENCE_KEY,
            preference_value: jsonValue,
          }]);
        if (error) throw error;
      }

      return newPreferences;
    },
    onSuccess: (newPreferences) => {
      queryClient.setQueryData(
        ["user-preferences", PREFERENCE_KEY, user?.id],
        newPreferences
      );
    },
  });

  const setPreferences = (newPreferences: Partial<KanbanPreferences>) => {
    const updated = { ...(preferences ?? DEFAULT_KANBAN_PREFERENCES), ...newPreferences };
    mutation.mutate(updated);
  };

  const toggleDefaultColumnsOpen = () => {
    const current = preferences?.defaultColumnsOpen ?? DEFAULT_KANBAN_PREFERENCES.defaultColumnsOpen;
    setPreferences({ defaultColumnsOpen: !current });
  };

  return {
    preferences: preferences ?? DEFAULT_KANBAN_PREFERENCES,
    setPreferences,
    toggleDefaultColumnsOpen,
    isLoading,
    isSaving: mutation.isPending,
  };
}
