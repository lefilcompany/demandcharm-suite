ALTER TABLE public.app_feature_flags ADD COLUMN IF NOT EXISTS rollout TEXT NOT NULL DEFAULT 'off';

UPDATE public.app_feature_flags SET rollout = 'internal' WHERE key = 'google_calendar_enabled';

CREATE TABLE IF NOT EXISTS public.google_calendar_rollout_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

GRANT ALL ON public.google_calendar_rollout_users TO service_role;

ALTER TABLE public.google_calendar_rollout_users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.google_calendar_rollout_users (user_id, note)
VALUES ('c26429ce-f7b9-4557-aeb5-61007b6111ce', 'kelven.gomes@lefil.com.br - rollout interno');

DROP FUNCTION IF EXISTS public.get_google_calendar_connection_status();

CREATE OR REPLACE FUNCTION public.get_google_calendar_connection_status()
RETURNS TABLE(
  enabled boolean,
  available boolean,
  status text,
  google_account_email text,
  connected_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    c.google_account_email,
    c.connected_at,
    c.updated_at
  FROM (SELECT auth.uid() AS uid) u
  CROSS JOIN (SELECT rollout FROM public.app_feature_flags WHERE key = 'google_calendar_enabled') f
  LEFT JOIN public.google_calendar_connections c ON c.user_id = u.uid
  WHERE u.uid IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.get_google_calendar_connection_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_connection_status() TO authenticated;