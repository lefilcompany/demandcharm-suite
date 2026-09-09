ALTER TABLE public.google_calendar_connections
  DROP CONSTRAINT IF EXISTS google_calendar_connections_status_check;

ALTER TABLE public.google_calendar_connections
  ADD CONSTRAINT google_calendar_connections_status_check
  CHECK (status = ANY (ARRAY['connected'::text, 'revoked'::text, 'error'::text, 'reauth_required'::text]));

UPDATE public.google_calendar_connections
SET status = 'reauth_required', updated_at = now()
WHERE status = 'connected'
  AND NOT (
    COALESCE(scopes, ARRAY[]::text[]) @> ARRAY[
      'https://www.googleapis.com/auth/meetings.space.created',
      'https://www.googleapis.com/auth/meetings.space.readonly'
    ]::text[]
  );

DROP FUNCTION IF EXISTS public.get_google_calendar_connection_status();

CREATE FUNCTION public.get_google_calendar_connection_status()
 RETURNS TABLE(enabled boolean, available boolean, status text, scopes text[], needs_reconsent boolean, google_account_email text, connected_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (f.rollout <> 'off') AS enabled,
    CASE
      WHEN f.rollout = 'all' THEN true
      WHEN f.rollout = 'internal' AND EXISTS (
        SELECT 1 FROM public.google_calendar_rollout_users r WHERE r.user_id = auth.uid()
      ) THEN true
      ELSE false
    END AS available,
    c.status,
    c.scopes,
    (c.user_id IS NOT NULL AND NOT (
      COALESCE(c.scopes, ARRAY[]::text[]) @> ARRAY[
        'https://www.googleapis.com/auth/calendar.events.owned',
        'https://www.googleapis.com/auth/meetings.space.created',
        'https://www.googleapis.com/auth/meetings.space.readonly'
      ]::text[]
    )) AS needs_reconsent,
    c.google_account_email,
    c.connected_at,
    c.updated_at
  FROM (SELECT auth.uid() AS uid) u
  CROSS JOIN (SELECT rollout FROM public.app_feature_flags WHERE key = 'google_calendar_enabled') f
  LEFT JOIN public.google_calendar_connections c ON c.user_id = u.uid
  WHERE u.uid IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_google_calendar_connection_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_google_calendar_connection_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_connection_status() TO authenticated;