-- 1. OAuth state (single-use, expirável) — backend only
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  redirect_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_user_id ON public.google_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires_at ON public.google_oauth_states(expires_at);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

-- 2. Conexões Google Calendar (1 por usuário) — backend only
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_account_email text,
  google_account_id text,
  refresh_token_encrypted text,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_connections_status_check CHECK (status IN ('connected','revoked','error'))
);
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Feature flags (leitura apenas via RPC segura)
CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  key text NOT NULL PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_feature_flags TO service_role;
ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_feature_flags (key, enabled)
VALUES ('google_calendar_enabled', false), ('google_calendar_auto_accept_enabled', false)
ON CONFLICT (key) DO NOTHING;

-- 4. RPC segura de status
CREATE OR REPLACE FUNCTION public.get_google_calendar_connection_status()
RETURNS TABLE (
  enabled boolean,
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
    COALESCE((SELECT f.enabled FROM public.app_feature_flags f WHERE f.key = 'google_calendar_enabled'), false) AS enabled,
    c.status,
    c.google_account_email,
    c.connected_at,
    c.updated_at
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN public.google_calendar_connections c ON c.user_id = u.uid
  WHERE u.uid IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_google_calendar_connection_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_connection_status() TO authenticated;