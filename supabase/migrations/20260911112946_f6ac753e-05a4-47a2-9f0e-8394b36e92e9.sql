ALTER TABLE public.services ADD COLUMN IF NOT EXISTS behavior text NOT NULL DEFAULT 'standard';
DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_behavior_check CHECK (behavior IN ('standard', 'meeting'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.demand_requests ADD COLUMN IF NOT EXISTS meeting_plan jsonb;

UPDATE public.services SET behavior = 'meeting' WHERE catalog_key = 'gestao/reuniao-interna';

UPDATE public.google_calendar_connections
SET status = 'reauth_required', updated_at = now()
WHERE status = 'connected'
  AND NOT (COALESCE(scopes, ARRAY[]::text[]) @> ARRAY['https://www.googleapis.com/auth/calendar.events']::text[]);

CREATE OR REPLACE FUNCTION public.get_google_calendar_connection_status()
RETURNS TABLE(enabled boolean, available boolean, status text, scopes text[], needs_reconsent boolean, google_account_email text, connected_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (f.rollout <> 'off'),
    CASE WHEN f.rollout='all' THEN true WHEN f.rollout='internal' AND EXISTS (SELECT 1 FROM public.google_calendar_rollout_users r WHERE r.user_id=auth.uid()) THEN true ELSE false END,
    c.status, c.scopes,
    (c.user_id IS NOT NULL AND NOT (COALESCE(c.scopes, ARRAY[]::text[]) @> ARRAY[
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/meetings.space.created',
      'https://www.googleapis.com/auth/meetings.space.readonly'
    ]::text[])),
    c.google_account_email, c.connected_at, c.updated_at
  FROM (SELECT auth.uid() uid) u
  CROSS JOIN (SELECT rollout FROM public.app_feature_flags WHERE key='google_calendar_enabled') f
  LEFT JOIN public.google_calendar_connections c ON c.user_id=u.uid WHERE u.uid IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_google_calendar_connection_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_connection_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_demand(_user_id uuid, _demand_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demands d
    WHERE d.id = _demand_id
      AND (d.created_by = _user_id OR d.board_id IN (SELECT public.get_user_board_ids(_user_id)))
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_demand(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_demand(uuid, uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.demand_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL UNIQUE REFERENCES public.demands(id) ON DELETE CASCADE,
  organizer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Recife',
  create_google_meet boolean NOT NULL DEFAULT true,
  google_calendar_id text,
  google_event_id text,
  google_ical_uid text,
  google_event_url text,
  google_organizer_email text,
  google_meet_url text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('not_connected','pending','syncing','synced','failed','reauth_required','cancelled')),
  meet_status text NOT NULL DEFAULT 'pending' CHECK (meet_status IN ('none','pending','ready')),
  sync_attempts integer NOT NULL DEFAULT 0,
  last_sync_error text,
  next_retry_at timestamptz,
  last_synced_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_meetings TO authenticated;
GRANT ALL ON public.demand_meetings TO service_role;
ALTER TABLE public.demand_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accessible users can view demand meetings" ON public.demand_meetings FOR SELECT TO authenticated USING (public.can_access_demand(auth.uid(), demand_id));
CREATE POLICY "Organizer can create demand meetings" ON public.demand_meetings FOR INSERT TO authenticated WITH CHECK (public.can_access_demand(auth.uid(), demand_id) AND organizer_user_id = auth.uid());
CREATE POLICY "Organizer can update demand meetings" ON public.demand_meetings FOR UPDATE TO authenticated USING (organizer_user_id = auth.uid()) WITH CHECK (organizer_user_id = auth.uid());
CREATE POLICY "Organizer can delete demand meetings" ON public.demand_meetings FOR DELETE TO authenticated USING (organizer_user_id = auth.uid());
DROP TRIGGER IF EXISTS set_demand_meetings_updated_at ON public.demand_meetings;
CREATE TRIGGER set_demand_meetings_updated_at BEFORE UPDATE ON public.demand_meetings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.demand_meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.demand_meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  calendar_sync_status text NOT NULL DEFAULT 'invited' CHECK (calendar_sync_status IN ('invited','pending_auto_accept','auto_accepted','no_google_connection','failed','reauth_required','removed')),
  google_account_email text,
  google_event_id text,
  google_response_status text,
  sync_attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_sync_error text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id),
  UNIQUE (meeting_id, email)
);
GRANT SELECT ON public.demand_meeting_participants TO authenticated;
GRANT ALL ON public.demand_meeting_participants TO service_role;
ALTER TABLE public.demand_meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accessible users can view meeting participants" ON public.demand_meeting_participants FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.demand_meetings m WHERE m.id = meeting_id AND public.can_access_demand(auth.uid(), m.demand_id)));
CREATE INDEX IF NOT EXISTS idx_demand_meetings_retry ON public.demand_meetings(next_retry_at) WHERE sync_status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_dmp_meeting ON public.demand_meeting_participants(meeting_id);

CREATE OR REPLACE FUNCTION public.get_request_meeting_readiness(p_request_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'is_meeting', dr.meeting_plan IS NOT NULL,
    'organizer_connected', dr.meeting_plan IS NULL OR EXISTS (
      SELECT 1 FROM public.google_calendar_connections c
      WHERE c.user_id = dr.created_by AND c.status = 'connected'
    )
  )
  FROM public.demand_requests dr
  WHERE dr.id = p_request_id
    AND public.is_board_admin_or_moderator(auth.uid(), dr.board_id)
$$;
REVOKE ALL ON FUNCTION public.get_request_meeting_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_request_meeting_readiness(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_demand_meeting(p_demand_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_timezone text, p_create_google_meet boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator uuid; v_meeting_id uuid;
BEGIN
  SELECT created_by INTO v_creator FROM public.demands WHERE id = p_demand_id;
  IF v_creator IS NULL OR NOT public.can_access_demand(auth.uid(), p_demand_id) THEN RAISE EXCEPTION 'Sem permissão para configurar esta reunião'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.google_calendar_connections WHERE user_id = v_creator AND status = 'connected') THEN RAISE EXCEPTION 'Conecte seu Google Calendar antes de criar esta reunião'; END IF;

  INSERT INTO public.demand_meetings (demand_id, organizer_user_id, starts_at, ends_at, timezone, create_google_meet, sync_status, meet_status)
  VALUES (p_demand_id, v_creator, p_starts_at, p_ends_at, COALESCE(NULLIF(p_timezone,''),'America/Recife'), p_create_google_meet, 'pending', CASE WHEN p_create_google_meet THEN 'pending' ELSE 'none' END)
  ON CONFLICT (demand_id) DO UPDATE SET starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, timezone=EXCLUDED.timezone, create_google_meet=EXCLUDED.create_google_meet, sync_status='pending', next_retry_at=NULL
  RETURNING id INTO v_meeting_id;

  DELETE FROM public.demand_meeting_participants WHERE meeting_id=v_meeting_id AND user_id NOT IN (
    SELECT created_by FROM public.demands WHERE id=p_demand_id
    UNION SELECT user_id FROM public.demand_assignees WHERE demand_id=p_demand_id
  );

  INSERT INTO public.demand_meeting_participants(meeting_id,user_id,email)
  SELECT v_meeting_id, u.user_id, lower(u.email)
  FROM (
    SELECT d.created_by AS user_id, p.email FROM public.demands d JOIN public.profiles p ON p.id=d.created_by WHERE d.id=p_demand_id
    UNION
    SELECT da.user_id, p.email FROM public.demand_assignees da JOIN public.profiles p ON p.id=da.user_id WHERE da.demand_id=p_demand_id
  ) u WHERE u.email IS NOT NULL AND u.email LIKE '%@%'
  ON CONFLICT (meeting_id,user_id) DO UPDATE SET email=EXCLUDED.email, calendar_sync_status=CASE WHEN demand_meeting_participants.email<>EXCLUDED.email THEN 'invited' ELSE demand_meeting_participants.calendar_sync_status END;
  RETURN v_meeting_id;
END $$;
REVOKE ALL ON FUNCTION public.upsert_demand_meeting(uuid,timestamptz,timestamptz,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_demand_meeting(uuid,timestamptz,timestamptz,text,boolean) TO authenticated;