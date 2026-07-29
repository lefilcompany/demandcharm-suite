-- Cria o token de cron para o processamento de demandas recorrentes (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'recurring_demands_cron_token') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'recurring_demands_cron_token', 'Bearer token used by the process-recurring-demands cron job');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_recurring_demands_cron_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'recurring_demands_cron_token' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_recurring_demands_cron_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recurring_demands_cron_token() TO service_role;