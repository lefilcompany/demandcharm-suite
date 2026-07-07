
-- Add flag to force password reset for legacy users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS needs_password_reset boolean NOT NULL DEFAULT false;

-- Mark all existing users as needing a password reset
UPDATE public.profiles SET needs_password_reset = true WHERE needs_password_reset = false;

-- New signups do NOT need a reset — override default via trigger on handle_new_user is not modified;
-- instead, set default to false going forward for new rows.
ALTER TABLE public.profiles ALTER COLUMN needs_password_reset SET DEFAULT false;

-- RPC to check if an email requires password reset (legacy user)
CREATE OR REPLACE FUNCTION public.password_reset_required(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.needs_password_reset
     FROM public.profiles p
     WHERE lower(p.email) = lower(trim(_email))
     LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.password_reset_required(text) TO anon, authenticated;

-- RPC to clear the flag once the user completes the reset (called by edge function w/ service role)
CREATE OR REPLACE FUNCTION public.clear_password_reset_required(_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET needs_password_reset = false
  WHERE lower(email) = lower(trim(_email));
$$;

REVOKE ALL ON FUNCTION public.clear_password_reset_required(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_password_reset_required(text) TO service_role;
