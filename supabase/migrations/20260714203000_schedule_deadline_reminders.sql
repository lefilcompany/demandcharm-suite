-- Schedule deadline reminders every day at 09:00 America/Recife (12:00 UTC).
--
-- A random token is generated once and stored in Supabase Vault. Both scheduled
-- Edge Functions verify that token through a service-role-only RPC, so no
-- credential is committed to the repository and the existing CRON_SECRET
-- remains supported as a backwards-compatible authentication path.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'deadline_cron_secret'
  ) THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'deadline_cron_secret',
      'Bearer token generated for the daily check-deadlines pg_cron job'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_deadline_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, vault
AS $$
  SELECT
    p_secret IS NOT NULL
    AND p_secret <> ''
    AND EXISTS (
      SELECT 1
      FROM vault.decrypted_secrets
      WHERE name = 'deadline_cron_secret'
        AND secret = p_secret
    );
$$;

REVOKE ALL ON FUNCTION public.verify_deadline_cron_secret(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_deadline_cron_secret(text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_check_deadlines()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, extensions
AS $$
DECLARE
  deadline_secret text;
  request_id bigint;
BEGIN
  SELECT secret
  INTO deadline_secret
  FROM vault.decrypted_secrets
  WHERE name = 'deadline_cron_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF deadline_secret IS NULL OR deadline_secret = '' THEN
    RAISE EXCEPTION 'Vault secret deadline_cron_secret is not configured';
  END IF;

  SELECT net.http_post(
    url := 'https://erxhxmetrvkigjwxchbj.supabase.co/functions/v1/check-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || deadline_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_check_deadlines()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.invoke_check_deadlines() IS
  'Invokes the check-deadlines Edge Function using a token stored in Supabase Vault.';

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'check-deadlines-daily'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'check-deadlines-daily',
    '0 12 * * *',
    'SELECT public.invoke_check_deadlines();'
  );
END;
$$;
