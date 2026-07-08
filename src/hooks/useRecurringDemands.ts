import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface RecurringDemandInput {
  team_id: string;
  board_id: string;
  title: string;
  description?: string | null;
  priority?: string;
  status_id: string;
  service_id?: string | null;
  assignee_ids?: string[];
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  weekdays?: number[];
  day_of_month?: number | null;
  start_date: string;
  end_date?: string | null;
}

export function useRecurringDemands(boardId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recurring-demands", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_demands")
        .select("*")
        .eq("board_id", boardId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!boardId,
  });
}

export function useCreateRecurringDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecurringDemandInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      // Calculate next_run_date based on frequency and start_date
      const nextRunDate = calculateNextRunDate(
        input.frequency,
        input.start_date,
        input.weekdays,
        input.day_of_month
      );

      const { data, error } = await supabase
        .from("recurring_demands")
        .insert({
          team_id: input.team_id,
          board_id: input.board_id,
          created_by: userId,
          title: input.title,
          description: input.description || null,
          priority: input.priority || "média",
          status_id: input.status_id,
          service_id: input.service_id || null,
          assignee_ids: input.assignee_ids || [],
          frequency: input.frequency,
          weekdays: input.weekdays || [],
          day_of_month: input.day_of_month || null,
          start_date: input.start_date,
          end_date: input.end_date || null,
          next_run_date: nextRunDate,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-demands"] });
    },
  });
}

export interface RecurringDemandUpdate {
  id: string;
  title?: string;
  description?: string | null;
  priority?: string;
  frequency?: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  weekdays?: number[];
  day_of_month?: number | null;
  start_date?: string;
  end_date?: string | null;
}

export function useUpdateRecurringDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecurringDemandUpdate) => {
      const { id, ...fields } = input;

      // Recalculate next_run_date if schedule fields changed
      const updateData: Record<string, any> = { ...fields };
      if (fields.frequency || fields.weekdays || fields.day_of_month || fields.start_date) {
        // We need current data to fill in missing fields
        const { data: current } = await supabase
          .from("recurring_demands")
          .select("*")
          .eq("id", id)
          .single();

        if (current) {
          const freq = fields.frequency || current.frequency;
          const start = fields.start_date || current.start_date;
          const wdays = fields.weekdays ?? current.weekdays;
          const dom = fields.day_of_month !== undefined ? fields.day_of_month : current.day_of_month;
          updateData.next_run_date = calculateNextRunDate(freq, start, wdays, dom);
        }
      }

      const { data, error } = await supabase
        .from("recurring_demands")
        .update(updateData as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-demands"] });
    },
  });
}

export function useDeleteRecurringDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_demands")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-demands"] });
    },
  });
}

export function calculateNextRunDate(
  frequency: string,
  startDate: string,
  weekdays?: number[],
  dayOfMonth?: number | null
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + "T00:00:00");

  // If start_date is in the future or today, use it directly (or find first matching day)
  if (start >= today) {
    if ((frequency === "weekly" || frequency === "biweekly") && weekdays && weekdays.length > 0) {
      const d = new Date(start);
      // Find first matching weekday from start_date
      for (let i = 0; i < 7; i++) {
        if (weekdays.includes(d.getDay())) {
          return formatDate(adjustToBusinessDay(d));
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return formatDate(adjustToBusinessDay(start));
  }

  // If start_date is today or past, next run is tomorrow or next matching day
  if (frequency === "daily") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(adjustToBusinessDay(tomorrow));
  }

  if (frequency === "weekly" && weekdays && weekdays.length > 0) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1); // start from tomorrow
    for (let i = 0; i < 7; i++) {
      if (weekdays.includes(d.getDay())) {
        return formatDate(adjustToBusinessDay(d));
      }
      d.setDate(d.getDate() + 1);
    }
  }

  if (frequency === "biweekly") {
    // Biweekly: 2 weeks from start_date, find matching weekday
    const d = new Date(today);
    d.setDate(d.getDate() + 1); // start from tomorrow
    
    if (weekdays && weekdays.length > 0) {
      // Calculate weeks elapsed since start_date to align to the 2-week cycle
      const startMs = start.getTime();
      const diffMs = d.getTime() - startMs;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      const weeksUntilNextCycle = diffWeeks % 2 === 0 ? 0 : 1;
      
      // Jump to the start of the next valid 2-week cycle
      const cycleStart = new Date(d);
      if (weeksUntilNextCycle > 0) {
        cycleStart.setDate(cycleStart.getDate() + (7 * weeksUntilNextCycle) - (cycleStart.getDay() || 7) + 1);
      }
      
      // Find first matching weekday in the cycle week
      for (let i = 0; i < 14; i++) {
        const candidate = new Date(cycleStart);
        candidate.setDate(candidate.getDate() + i);
        if (candidate > today && weekdays.includes(candidate.getDay())) {
          return formatDate(adjustToBusinessDay(candidate));
        }
      }
    }
    
    // Fallback: just add 14 days from start or today
    const next = new Date(today);
    next.setDate(next.getDate() + 14);
    return formatDate(adjustToBusinessDay(next));
  }

  if (frequency === "monthly") {
    const day = dayOfMonth || start.getDate();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(day, 28));
    return formatDate(adjustToBusinessDay(nextMonth));
  }

  // Fallback
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(adjustToBusinessDay(tomorrow));
}

function adjustToBusinessDay(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
  if (dayOfWeek === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
