CREATE OR REPLACE FUNCTION public.get_google_calendar_connection_status()
RETURNS TABLE(enabled boolean, available boolean, status text, scopes text[], needs_reconsent boolean, google_account_email text, connected_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (f.rollout <> 'off'),
    CASE WHEN f.rollout='all' THEN true WHEN f.rollout='internal' AND EXISTS (SELECT 1 FROM public.google_calendar_rollout_users r WHERE r.user_id=auth.uid()) THEN true ELSE false END,
    c.status, c.scopes,
    (
      c.user_id IS NOT NULL AND NOT (
        (
          COALESCE(c.scopes, ARRAY[]::text[]) && ARRAY[
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.events.owned'
          ]::text[]
        )
        AND COALESCE(c.scopes, ARRAY[]::text[]) @> ARRAY[
          'https://www.googleapis.com/auth/meetings.space.created',
          'https://www.googleapis.com/auth/meetings.space.readonly'
        ]::text[]
      )
    ),
    c.google_account_email, c.connected_at, c.updated_at
  FROM (SELECT auth.uid() uid) u
  CROSS JOIN (SELECT rollout FROM public.app_feature_flags WHERE key='google_calendar_enabled') f
  LEFT JOIN public.google_calendar_connections c ON c.user_id=u.uid WHERE u.uid IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_google_calendar_connection_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_connection_status() TO authenticated;

UPDATE public.google_calendar_connections
SET status = 'connected', updated_at = now()
WHERE status = 'reauth_required'
  AND (scopes && ARRAY['https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar.events.owned']::text[])
  AND scopes @> ARRAY['https://www.googleapis.com/auth/meetings.space.created','https://www.googleapis.com/auth/meetings.space.readonly']::text[];