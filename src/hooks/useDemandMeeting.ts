import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { buildMeetingRange, DEFAULT_MEETING_TIMEZONE, MeetingFormValue } from "@/lib/meetingUtils";

const db = supabase as any;

export interface DemandMeeting {
  id: string;
  demand_id: string;
  organizer_user_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  create_google_meet: boolean;
  google_event_url: string | null;
  google_meet_url: string | null;
  google_event_id: string | null;
  google_organizer_email: string | null;
  sync_status: string;
  meet_status: string;
  last_sync_error: string | null;
}

export interface DemandMeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string | null;
  email: string;
  calendar_sync_status: string;
  google_account_email: string | null;
  next_retry_at: string | null;
}

export function useUserTimezone() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile-timezone", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return DEFAULT_MEETING_TIMEZONE;
      const { data } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      return ((data as any)?.timezone as string | null) || DEFAULT_MEETING_TIMEZONE;
    },
  });
}

export function useDemandMeeting(demandId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["demand-meeting", demandId],
    enabled: !!user && !!demandId,
    queryFn: async () => {
      const { data: meeting, error } = await db.from("demand_meetings").select("*").eq("demand_id", demandId).maybeSingle();
      if (error) throw error;
      if (!meeting) return null;
      const { data: participants, error: participantError } = await db.from("demand_meeting_participants").select("id, meeting_id, user_id, email, calendar_sync_status, google_account_email, next_retry_at").eq("meeting_id", meeting.id);
      if (participantError) throw participantError;
      return { meeting: meeting as DemandMeeting, participants: (participants ?? []) as DemandMeetingParticipant[] };
    },
  });
}

export async function persistDemandMeeting(input: { demandId: string; dueDate: string; form: MeetingFormValue; timezone: string }) {
  const range = buildMeetingRange(input.dueDate, input.form, input.timezone);
  const { data, error } = await db.rpc("upsert_demand_meeting", {
    p_demand_id: input.demandId,
    p_starts_at: range.starts_at,
    p_ends_at: range.ends_at,
    p_timezone: input.timezone,
    p_create_google_meet: input.form.createGoogleMeet,
  });
  if (error) throw error;
  return data as string;
}

export async function requestMeetingSync(meetingId: string, action: "sync" | "cancel" | "verify" = "sync") {
  const { data, error } = await supabase.functions.invoke("google-calendar-sync-meeting", { body: { meeting_id: meetingId, action } });
  if (error) throw error;
  return data;
}

export function useSyncDemandMeeting() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ meetingId, action = "sync" }: { meetingId: string; action?: "sync" | "cancel" | "verify" }) => requestMeetingSync(meetingId, action), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["demand-meeting"] }) });
}

export function useSyncMeetingParticipants() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async (meetingId: string) => supabase.functions.invoke("google-calendar-sync-participant", { body: { meeting_id: meetingId } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["demand-meeting"] }) });
}